"use server";

import { revalidatePath } from "next/cache";
import { isAdminAuthenticated } from "@/lib/admin-session";
import { getPrisma } from "@/lib/prisma";

export type ResetDataResult =
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export async function resetApplicationData(confirmation: string): Promise<ResetDataResult> {
  if (!(await isAdminAuthenticated())) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  if (confirmation !== "RESET") return { status: "error", message: "Vui lòng nhập đúng RESET để xác nhận." };

  try {
    const prisma = getPrisma();
    const [webhookLogs, payments, sessions, users] = await prisma.$transaction([
      prisma.webhookLog.deleteMany(),
      prisma.paymentRequest.deleteMany(),
      prisma.footballSession.deleteMany(),
      prisma.user.deleteMany(),
    ]);

    revalidatePath("/admin");
    revalidatePath("/admin/collections");
    revalidatePath("/admin/transactions");
    revalidatePath("/admin/settings");
    revalidatePath("/client");

    return {
      status: "success",
      message: `Đã xóa ${users.count} người dùng, ${sessions.count} khoản thu, ${payments.count} giao dịch và ${webhookLogs.count} webhook log.`,
    };
  } catch (error) {
    console.error("Không thể reset dữ liệu:", error);
    return { status: "error", message: "Không thể reset dữ liệu. Vui lòng thử lại." };
  }
}
