import { NextResponse } from "next/server";
import { runDueDebtReminders } from "@/lib/debt-reminder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.JOB_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("x-job-secret") === secret
    || request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!process.env.JOB_SECRET?.trim()) {
    return NextResponse.json({ success: false, error: "JOB_SECRET chưa được cấu hình." }, { status: 503 });
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Secret của job không hợp lệ." }, { status: 401 });
  }

  try {
    const summary = await runDueDebtReminders();
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    console.error("Không thể chạy endpoint nhắc nợ:", error);
    return NextResponse.json({ success: false, error: "Không thể chạy job nhắc nợ." }, { status: 500 });
  }
}
