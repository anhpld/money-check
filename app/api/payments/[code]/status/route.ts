import { NextResponse } from "next/server";
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

  return NextResponse.json(
    { success: true, payment },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
  );
}

