"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-session";

export type ConfirmTransactionResult =
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const reviewableStatuses = ["REVIEW_REQUIRED"] as const;

export async function confirmTransaction(id: string): Promise<ConfirmTransactionResult> {
  if (!(await isAdminAuthenticated())) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  if (!id) return { status: "error", message: "Giao dịch không hợp lệ." };

  try {
    const prisma = getPrisma();
    const payment = await prisma.paymentRequest.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!payment) return { status: "error", message: "Không tìm thấy giao dịch." };
    if (payment.status === "PAID") return { status: "success", message: "Giao dịch đã được xác nhận trước đó." };
    if (!reviewableStatuses.some((status) => status === payment.status)) {
      return { status: "error", message: "Trạng thái giao dịch này không thể xác nhận thủ công." };
    }

    await prisma.$transaction(async (transaction) => {
      const claimed = await transaction.paymentRequest.updateMany({
        where: { id: payment.id, status: { in: [...reviewableStatuses] } },
        data: { status: "PAID", resolvedAt: new Date() },
      });
      if (!claimed.count) throw new Error("TRANSACTION_ALREADY_RESOLVED");

      for (const item of payment.items) {
        await transaction.sessionMember.update({
          where: { id: item.sessionMemberId },
          data: { amountPaid: { increment: item.expectedAmount } },
        });
      }
    });

    revalidatePath("/admin/transactions");
    revalidatePath(`/admin/transactions/${payment.id}`);
    revalidatePath("/admin/collections");
    revalidatePath("/client");
    revalidatePath(`/client/${payment.userId}`);
    return { status: "success", message: "Đã xác nhận và ghi nhận khoản thanh toán." };
  } catch (error) {
    if (error instanceof Error && error.message === "TRANSACTION_ALREADY_RESOLVED") {
      return { status: "error", message: "Giao dịch vừa được xử lý ở một phiên khác. Vui lòng tải lại." };
    }
    console.error("Không thể xác nhận giao dịch:", error);
    return { status: "error", message: "Không thể xác nhận giao dịch. Vui lòng thử lại." };
  }
}
