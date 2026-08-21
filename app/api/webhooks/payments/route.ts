import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";

type WebhookBody = {
  code?: unknown;
  amount?: unknown;
  content?: unknown;
  // Kept for backward compatibility with the first webhook contract.
  fullContent?: unknown;
};

type ProcessedPayment = {
  code: string;
  status: "PENDING" | "CANCELLED" | "UNDERPAID" | "PAID" | "OVERPAID" | "REVIEW_REQUIRED";
  expectedAmount: number;
  actualAmount: number | null;
  duplicate: boolean;
  user: { id: string; name: string };
  items: Array<{
    sessionMemberId: string;
    title: string;
    expectedAmount: number;
  }>;
};

function webhookIsAuthorized(request: Request) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true;

  const directSecret = request.headers.get("x-webhook-secret");
  const authorization = request.headers.get("authorization");
  return directSecret === secret || authorization === `Bearer ${secret}`;
}

function parseAmount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\s*\d[\d.,\s\u00A0\u202F]*(?:₫|đ|vnd)?\s*$/iu.test(value)) {
    return Number(value.replace(/\D/g, ""));
  }
  return Number.NaN;
}

function parseAmountFromContent(content: string) {
  const match = content.match(/số\s*tiền\s*([0-9][0-9.,\s\u00A0\u202F]*)\s*₫/iu);
  return match ? Number(match[1].replace(/\D/g, "")) : Number.NaN;
}

function responseMessage(status: ProcessedPayment["status"], duplicate: boolean) {
  if (duplicate) return "Webhook này đã được xử lý trước đó.";
  if (status === "PAID") return "Thanh toán khớp và đã được ghi nhận.";
  if (status === "UNDERPAID") return "Đã ghi nhận giao dịch thiếu tiền, cần admin kiểm tra.";
  if (status === "OVERPAID") return "Đã ghi nhận giao dịch thừa tiền, cần admin kiểm tra.";
  if (status === "REVIEW_REQUIRED") return "Đã nhận tiền từ mã không còn hiệu lực, cần admin kiểm tra.";
  if (status === "CANCELLED") return "Mã thanh toán không còn hiệu lực.";
  return "Đã nhận webhook.";
}

export async function POST(request: Request) {
  if (!webhookIsAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Webhook secret không hợp lệ." },
      { status: 401 },
    );
  }

  let body: WebhookBody;
  try {
    body = await request.json() as WebhookBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Body phải là JSON hợp lệ." },
      { status: 400 },
    );
  }

  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const fullContent = typeof body.content === "string"
    ? body.content.trim()
    : typeof body.fullContent === "string"
      ? body.fullContent.trim()
      : "";
  const payloadAmount = parseAmount(body.amount);
  const amount = Number.isSafeInteger(payloadAmount) && payloadAmount > 0
    ? payloadAmount
    : parseAmountFromContent(fullContent);

  if (!/^PAY[A-F0-9]{8}$/.test(code)) {
    return NextResponse.json(
      { success: false, error: "Code không đúng định dạng PAYXXXXXXXX." },
      { status: 400 },
    );
  }
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return NextResponse.json(
      { success: false, error: "Không tìm thấy số tiền hợp lệ trong amount hoặc content." },
      { status: 400 },
    );
  }
  if (!fullContent) {
    return NextResponse.json(
      { success: false, error: "Content không được để trống." },
      { status: 400 },
    );
  }
  if (fullContent.length > 10_000) {
    return NextResponse.json(
      { success: false, error: "Content vượt quá 10.000 ký tự." },
      { status: 400 },
    );
  }

  try {
    const prisma = getPrisma();
    const result = await prisma.$transaction(async (transaction): Promise<ProcessedPayment | null> => {
      const paymentRequest = await transaction.paymentRequest.findUnique({
        where: { code },
        include: {
          user: { select: { id: true, name: true } },
          items: {
            include: {
              sessionMember: {
                include: { session: { select: { title: true } } },
              },
            },
          },
        },
      });

      if (!paymentRequest) return null;

      const serializedItems = paymentRequest.items.map((item) => ({
        sessionMemberId: item.sessionMemberId,
        title: item.sessionMember.session.title,
        expectedAmount: item.expectedAmount,
      }));

      if (paymentRequest.status === "CANCELLED") {
        const reviewed = await transaction.paymentRequest.updateMany({
          where: { id: paymentRequest.id, status: "CANCELLED" },
          data: {
            actualAmount: amount,
            fullContent,
            status: "REVIEW_REQUIRED",
            processedAt: new Date(),
          },
        });
        if (reviewed.count) {
          // Stop any newer QR for this user until the late payment is reviewed.
          await transaction.paymentRequest.updateMany({
            where: {
              userId: paymentRequest.userId,
              id: { not: paymentRequest.id },
              status: "PENDING",
            },
            data: { status: "CANCELLED", processedAt: new Date() },
          });
          return {
            code: paymentRequest.code,
            status: "REVIEW_REQUIRED",
            expectedAmount: paymentRequest.expectedAmount,
            actualAmount: amount,
            duplicate: false,
            user: paymentRequest.user,
            items: serializedItems,
          };
        }

        const current = await transaction.paymentRequest.findUniqueOrThrow({
          where: { id: paymentRequest.id },
        });
        return {
          code: current.code,
          status: current.status,
          expectedAmount: current.expectedAmount,
          actualAmount: current.actualAmount,
          duplicate: true,
          user: paymentRequest.user,
          items: serializedItems,
        };
      }

      if (paymentRequest.status !== "PENDING") {
        return {
          code: paymentRequest.code,
          status: paymentRequest.status,
          expectedAmount: paymentRequest.expectedAmount,
          actualAmount: paymentRequest.actualAmount,
          duplicate: true,
          user: paymentRequest.user,
          items: serializedItems,
        };
      }

      const status = amount === paymentRequest.expectedAmount
        ? "PAID"
        : amount < paymentRequest.expectedAmount
          ? "UNDERPAID"
          : "OVERPAID";

      // The conditional update claims this PENDING request. If two webhook calls
      // arrive together, only one is allowed to continue to the balance updates.
      const claimed = await transaction.paymentRequest.updateMany({
        where: { id: paymentRequest.id, status: "PENDING" },
        data: {
          actualAmount: amount,
          fullContent,
          status,
          processedAt: new Date(),
        },
      });

      if (!claimed.count) {
        const current = await transaction.paymentRequest.findUniqueOrThrow({
          where: { id: paymentRequest.id },
        });
        return {
          code: current.code,
          status: current.status,
          expectedAmount: current.expectedAmount,
          actualAmount: current.actualAmount,
          duplicate: true,
          user: paymentRequest.user,
          items: serializedItems,
        };
      }

      if (status === "PAID") {
        for (const item of paymentRequest.items) {
          await transaction.sessionMember.update({
            where: { id: item.sessionMemberId },
            data: { amountPaid: { increment: item.expectedAmount } },
          });
        }
      }

      return {
        code: paymentRequest.code,
        status,
        expectedAmount: paymentRequest.expectedAmount,
        actualAmount: amount,
        duplicate: false,
        user: paymentRequest.user,
        items: serializedItems,
      };
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy yêu cầu thanh toán với code này." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: responseMessage(result.status, result.duplicate),
      payment: {
        ...result,
        difference: (result.actualAmount ?? 0) - result.expectedAmount,
      },
    });
  } catch (error) {
    console.error("Không thể xử lý payment webhook:", error);
    return NextResponse.json(
      { success: false, error: "Không thể xử lý webhook." },
      { status: 500 },
    );
  }
}
