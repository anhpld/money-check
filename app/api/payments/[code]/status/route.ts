import { NextResponse } from "next/server";
import {
  RECENT_PAID_USER_COOKIE,
  RECENT_PAID_USER_COOKIE_MAX_AGE,
} from "@/lib/client-preference";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code: rawCode } = await params;
  const code = rawCode.trim().toUpperCase();

  if (!/^PAY[A-F0-9]{8}$/.test(code)) {
    return NextResponse.json(
      { success: false, error: "Mã thanh toán không hợp lệ." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const payment = await getPrisma().paymentRequest.findUnique({
    where: { code },
    select: {
      userId: true,
      status: true,
      expectedAmount: true,
      actualAmount: true,
      processedAt: true,
    },
  });

  if (!payment) {
    return NextResponse.json(
      { success: false, error: "Không tìm thấy mã thanh toán." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { userId, ...publicPayment } = payment;
  const response = NextResponse.json(
    { success: true, payment: publicPayment },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
  );

  if (payment.status === "PAID") {
    response.cookies.set(RECENT_PAID_USER_COOKIE, userId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/client",
      maxAge: RECENT_PAID_USER_COOKIE_MAX_AGE,
      priority: "medium",
    });
  }

  return response;
}
