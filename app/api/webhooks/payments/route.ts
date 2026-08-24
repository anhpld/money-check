import { NextResponse } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { sendPaymentReceivedNotification } from "@/lib/send-payment-notification";

export const runtime = "nodejs";

type WebhookBody = {
  code?: unknown;
  amount?: unknown;
  content?: unknown;
  // Kept for backward compatibility with the first webhook contract.
  fullContent?: unknown;
};

type WebhookLogStatus = "SUCCESS" | "PAID" | "UNDERPAID" | "OVERPAID" | "REVIEW_REQUIRED" | "IGNORED" | "DUPLICATE" | "NOT_FOUND" | "INVALID" | "FAILED";

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
    playedAt: Date;
    footballAmount: number;
    options: Array<{ name: string; amount: number }>;
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
  if (status === "CANCELLED") return "Mã thanh toán đã bị hủy nên webhook được bỏ qua.";
  if (duplicate) return "Webhook này đã được xử lý trước đó.";
  if (status === "PAID") return "Thanh toán khớp và đã được ghi nhận.";
  if (status === "UNDERPAID") return "Số tiền chuyển bị thiếu. Khoản nợ được giữ nguyên, có thể tạo mã thanh toán mới.";
  if (status === "OVERPAID") return "Số tiền chuyển bị thừa. Khoản nợ được giữ nguyên, có thể tạo mã thanh toán mới.";
  if (status === "REVIEW_REQUIRED") return "Đã nhận tiền từ mã không còn hiệu lực, cần admin kiểm tra.";
  return "Đã nhận webhook.";
}

async function saveWebhookLog(requestBody: Prisma.InputJsonValue, status: WebhookLogStatus) {
  try {
    await getPrisma().webhookLog.create({ data: { request: requestBody, status } });
  } catch (error) {
    console.error("Không thể lưu webhook log:", error);
  }
}

async function loggedResponse(
  requestBody: Prisma.InputJsonValue,
  logStatus: WebhookLogStatus,
  body: Record<string, unknown>,
  responseStatus = 200,
) {
  await saveWebhookLog(requestBody, logStatus);
  return NextResponse.json(body, { status: responseStatus });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  let parsedBody: unknown;
  let logRequest: Prisma.InputJsonValue;

  try {
    parsedBody = JSON.parse(rawBody);
    logRequest = parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)
      ? parsedBody as Prisma.InputJsonObject
      : { value: parsedBody as Prisma.InputJsonValue };
  } catch {
    logRequest = { raw: rawBody.slice(0, 20_000) };
    return loggedResponse(
      logRequest,
      "INVALID",
      { success: false, error: "Body phải là JSON hợp lệ." },
      400,
    );
  }

  if (!webhookIsAuthorized(request)) {
    return loggedResponse(
      logRequest,
      "INVALID",
      { success: false, error: "Webhook secret không hợp lệ." },
      401,
    );
  }

  const body = parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)
    ? parsedBody as WebhookBody
    : {};

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
    return loggedResponse(
      logRequest,
      "INVALID",
      { success: false, error: "Code không đúng định dạng PAYXXXXXXXX." },
      400,
    );
  }
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return loggedResponse(
      logRequest,
      "INVALID",
      { success: false, error: "Không tìm thấy số tiền hợp lệ trong amount hoặc content." },
      400,
    );
  }
  if (!fullContent) {
    return loggedResponse(
      logRequest,
      "INVALID",
      { success: false, error: "Content không được để trống." },
      400,
    );
  }
  if (fullContent.length > 10_000) {
    return loggedResponse(
      logRequest,
      "INVALID",
      { success: false, error: "Content vượt quá 10.000 ký tự." },
      400,
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
              options: { orderBy: { sortOrder: "asc" } },
              sessionMember: {
                include: { session: { select: { title: true, playedAt: true } } },
              },
            },
          },
        },
      });

      if (!paymentRequest) return null;

      const serializedItems = paymentRequest.items.map((item) => ({
        sessionMemberId: item.sessionMemberId,
        title: item.sessionMember.session.title,
        playedAt: item.sessionMember.session.playedAt,
        footballAmount: item.footballAmount,
        options: item.options.map((option) => ({ name: option.name, amount: option.amount })),
        expectedAmount: item.expectedAmount,
      }));

      if (paymentRequest.status !== "PENDING") {
        // Terminal states are immutable. Late or duplicate webhooks are logged
        // but must never change this request, another request, or member debt.
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
      const processedAt = new Date();

      // The conditional update claims this PENDING request. If two webhook calls
      // arrive together, only one is allowed to continue to the balance updates.
      const claimed = await transaction.paymentRequest.updateMany({
        where: { id: paymentRequest.id, status: "PENDING" },
        data: {
          actualAmount: amount,
          fullContent,
          status,
          processedAt,
          resolvedAt: processedAt,
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
            data: { amountPaid: { increment: item.footballAmount } },
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
      return loggedResponse(
        logRequest,
        "NOT_FOUND",
        { success: false, error: "Không tìm thấy yêu cầu thanh toán với code này." },
        404,
      );
    }

    let notificationStatus: "sent" | "skipped" | "failed" = "skipped";
    if (!result.duplicate && result.actualAmount) {
      const notification = await sendPaymentReceivedNotification({
        amount: result.actualAmount,
        expectedAmount: result.expectedAmount,
        status: result.status,
        userName: result.user.name,
        items: result.items,
      });
      notificationStatus = notification.status;
      if (notification.status === "failed") {
        console.error(`Không thể gửi thông báo thanh toán ${result.code}:`, notification.error);
      }
    }

    const logStatus: WebhookLogStatus = result.status === "CANCELLED"
      ? "IGNORED"
      : result.duplicate
        ? "DUPLICATE"
        : result.status === "PAID" || result.status === "UNDERPAID" || result.status === "OVERPAID" || result.status === "REVIEW_REQUIRED"
          ? result.status
          : "SUCCESS";

    return loggedResponse(
      logRequest,
      logStatus,
      {
        success: true,
        message: responseMessage(result.status, result.duplicate),
        payment: {
          ...result,
          difference: (result.actualAmount ?? 0) - result.expectedAmount,
        },
        notification: notificationStatus,
      },
    );
  } catch (error) {
    console.error("Không thể xử lý payment webhook:", error);
    return loggedResponse(
      logRequest,
      "FAILED",
      { success: false, error: "Không thể xử lý webhook." },
      500,
    );
  }
}
