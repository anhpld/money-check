import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";

const PAYMENT_ACCOUNT = "PSP2623210100000214";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code: rawCode } = await params;
  const code = rawCode.trim().toUpperCase();

  if (!/^PAY[A-F0-9]{8}$/.test(code)) {
    return Response.json({ success: false, error: "Mã thanh toán không hợp lệ." }, { status: 400 });
  }

  const payment = await getPrisma().paymentRequest.findUnique({
    where: { code },
    select: { expectedAmount: true },
  });
  if (!payment) {
    return Response.json({ success: false, error: "Không tìm thấy mã thanh toán." }, { status: 404 });
  }

  const qrUrl = new URL(`https://img.vietqr.io/image/momo-${PAYMENT_ACCOUNT}-qr_only.png`);
  qrUrl.searchParams.set("amount", String(payment.expectedAmount));
  qrUrl.searchParams.set("addInfo", code);

  try {
    const qrResponse = await fetch(qrUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const contentType = qrResponse.headers.get("content-type") ?? "";
    if (!qrResponse.ok || !contentType.startsWith("image/")) {
      return Response.json({ success: false, error: "Không thể tải ảnh QR từ VietQR." }, { status: 502 });
    }

    return new Response(await qrResponse.arrayBuffer(), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="QR-${code}.png"`,
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(`Không thể tải QR ${code}:`, error);
    return Response.json({ success: false, error: "Không thể tải ảnh QR." }, { status: 502 });
  }
}
