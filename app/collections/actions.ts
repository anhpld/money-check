"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-session";
import type { CollectionActionResult, SaveCollectionInput } from "@/app/collections/types";

export type ManualPaymentResult =
  | { status: "success"; message: string; amountPaid: number; manualPaidAt: string | null }
  | { status: "error"; message: string };

const blockingPaymentStatuses = ["REVIEW_REQUIRED"] as const;

export async function markMemberPaidManually(sessionMemberId: string): Promise<ManualPaymentResult> {
  if (!(await isAdminAuthenticated())) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  if (!sessionMemberId) return { status: "error", message: "Khoản thanh toán không hợp lệ." };

  try {
    const prisma = getPrisma();
    const result = await prisma.$transaction(async (transaction) => {
      const member = await transaction.sessionMember.findUnique({
        where: { id: sessionMemberId },
        include: {
          session: { select: { id: true, status: true } },
          paymentItems: {
            where: { paymentRequest: { status: { in: [...blockingPaymentStatuses] } } },
            select: { id: true },
            take: 1,
          },
        },
      });

      if (!member) throw new Error("MEMBER_NOT_FOUND");
      if (member.session.status === "DRAFT") throw new Error("SESSION_NOT_PUBLISHED");
      if (member.paymentItems.length) throw new Error("PAYMENT_NEEDS_REVIEW");
      if (member.amountPaid >= member.amountDue) {
        return { amountPaid: member.amountPaid, manualPaidAt: member.manualPaidAt, sessionId: member.session.id, alreadyPaid: true };
      }

      await transaction.paymentRequest.updateMany({
        where: {
          status: "PENDING",
          items: { some: { sessionMemberId: member.id } },
        },
        data: { status: "CANCELLED" },
      });

      const updated = await transaction.sessionMember.update({
        where: { id: member.id },
        data: { amountPaid: member.amountDue, manualPaidAt: new Date() },
        select: { amountPaid: true, manualPaidAt: true },
      });

      return { amountPaid: updated.amountPaid, manualPaidAt: updated.manualPaidAt, sessionId: member.session.id, alreadyPaid: false };
    });

    revalidatePath("/admin/collections");
    revalidatePath(`/admin/collections/${result.sessionId}`);
    revalidatePath("/client");
    return {
      status: "success",
      message: result.alreadyPaid ? "Khoản này đã được thanh toán trước đó." : "Đã ghi nhận thanh toán tiền mặt.",
      amountPaid: result.amountPaid,
      manualPaidAt: result.manualPaidAt?.toISOString() ?? null,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "MEMBER_NOT_FOUND") return { status: "error", message: "Không tìm thấy người trong khoản thu." };
      if (error.message === "SESSION_NOT_PUBLISHED") return { status: "error", message: "Hãy public khoản thu trước khi ghi nhận thanh toán." };
      if (error.message === "PAYMENT_NEEDS_REVIEW") {
        return { status: "error", message: "Người này đang có giao dịch cần kiểm tra. Hãy xử lý giao dịch đó trước." };
      }
    }
    console.error("Không thể ghi nhận thanh toán thủ công:", error);
    return { status: "error", message: "Không thể ghi nhận thanh toán. Vui lòng thử lại." };
  }
}

function validateCollection(input: SaveCollectionInput): string | null {
  if (input.title.trim().length < 3) return "Tên buổi bóng cần có ít nhất 3 ký tự.";
  if (!input.playedAt || Number.isNaN(new Date(input.playedAt).getTime())) return "Ngày đá bóng không hợp lệ.";
  if (!Number.isInteger(input.totalAmount) || input.totalAmount <= 0) return "Tổng tiền phải lớn hơn 0.";
  if (!Number.isInteger(input.defaultWaterAmount) || input.defaultWaterAmount < 0) return "Tiền nước gợi ý không hợp lệ.";
  if (!input.members.length) return "Cần chọn ít nhất một người tham gia.";

  const userIds = new Set<string>();
  for (const member of input.members) {
    if (!member.userId || userIds.has(member.userId)) return "Danh sách người tham gia không hợp lệ.";
    if (!Number.isInteger(member.slots) || member.slots < 1) return "Số slot của người tham gia không hợp lệ.";
    if (!Number.isInteger(member.amountDue) || member.amountDue < 0) return "Số tiền của người tham gia không hợp lệ.";
    if (typeof member.note !== "string" || member.note.length > 500) return "Ghi chú của người tham gia không hợp lệ.";
    userIds.add(member.userId);
  }

  return null;
}

export async function saveCollection(input: SaveCollectionInput): Promise<CollectionActionResult> {
  if (!(await isAdminAuthenticated())) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  const validationError = validateCollection(input);
  if (validationError) return { status: "error", message: validationError };

  const title = input.title.trim();
  const note = input.note.trim() || null;
  const playedAt = new Date(input.playedAt);

  try {
    const prisma = getPrisma();

    if (!input.id) {
      const session = await prisma.footballSession.create({
        data: {
          title,
          playedAt,
          note,
          totalAmount: input.totalAmount,
          defaultWaterAmount: input.defaultWaterAmount,
          status: input.status,
          publishedAt: input.status === "PUBLISHED" ? new Date() : null,
          members: {
            create: input.members.map((member) => ({
              userId: member.userId,
              slots: member.slots,
              amountDue: member.amountDue,
              note: member.note.trim() || null,
            })),
          },
        },
        select: { id: true },
      });

      revalidatePath("/admin/collections");
      return {
        status: "success",
        message: input.status === "PUBLISHED" ? "Đã public khoản thu." : "Đã lưu bản nháp.",
        id: session.id,
      };
    }

    const existing = await prisma.footballSession.findUnique({
      where: { id: input.id },
      include: { members: true },
    });
    if (!existing) return { status: "error", message: "Không tìm thấy khoản thu." };

    const incomingByUser = new Map(input.members.map((member) => [member.userId, member]));
    const removedPaidMember = existing.members.find(
      (member) => !incomingByUser.has(member.userId) && member.amountPaid > 0,
    );
    if (removedPaidMember) {
      return { status: "error", message: "Không thể bỏ người đã phát sinh thanh toán khỏi buổi bóng." };
    }

    const nextStatus = existing.status === "DRAFT" ? input.status : existing.status;
    await prisma.$transaction(async (transaction) => {
      await transaction.footballSession.update({
        where: { id: existing.id },
        data: {
          title,
          playedAt,
          note,
          totalAmount: input.totalAmount,
          defaultWaterAmount: input.defaultWaterAmount,
          status: nextStatus,
          publishedAt: existing.publishedAt ?? (nextStatus === "PUBLISHED" ? new Date() : null),
        },
      });

      for (const current of existing.members) {
        const incoming = incomingByUser.get(current.userId);
        if (!incoming) {
          await transaction.sessionMember.delete({ where: { id: current.id } });
          continue;
        }

        const difference = incoming.amountDue - current.amountDue;
        await transaction.sessionMember.update({
          where: { id: current.id },
          data: { slots: incoming.slots, amountDue: incoming.amountDue, note: incoming.note.trim() || null },
        });
        if (existing.status !== "DRAFT" && difference !== 0) {
          await transaction.chargeAdjustment.create({
            data: { sessionMemberId: current.id, amount: difference, reason: "Admin điều chỉnh khoản thu sau khi public" },
          });
        }
        incomingByUser.delete(current.userId);
      }

      for (const member of incomingByUser.values()) {
        await transaction.sessionMember.create({
          data: { sessionId: existing.id, userId: member.userId, slots: member.slots, amountDue: member.amountDue, note: member.note.trim() || null },
        });
      }
    });

    revalidatePath("/admin/collections");
    revalidatePath(`/admin/collections/${existing.id}`);
    return { status: "success", message: "Đã lưu thay đổi khoản thu.", id: existing.id };
  } catch (error) {
    console.error("Không thể lưu khoản thu:", error);
    return { status: "error", message: "Không thể lưu khoản thu. Vui lòng thử lại." };
  }
}
