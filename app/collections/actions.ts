"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/prisma";
import type { CollectionActionResult, SaveCollectionInput } from "@/app/collections/types";

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
    userIds.add(member.userId);
  }

  return null;
}

export async function saveCollection(input: SaveCollectionInput): Promise<CollectionActionResult> {
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
            })),
          },
        },
        select: { id: true },
      });

      revalidatePath("/collections");
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
    const adjustmentReason = input.adjustmentReason?.trim() || "Admin điều chỉnh khoản thu sau khi public";

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
          data: { slots: incoming.slots, amountDue: incoming.amountDue },
        });
        if (existing.status !== "DRAFT" && difference !== 0) {
          await transaction.chargeAdjustment.create({
            data: { sessionMemberId: current.id, amount: difference, reason: adjustmentReason },
          });
        }
        incomingByUser.delete(current.userId);
      }

      for (const member of incomingByUser.values()) {
        await transaction.sessionMember.create({
          data: { sessionId: existing.id, userId: member.userId, slots: member.slots, amountDue: member.amountDue },
        });
      }
    });

    revalidatePath("/collections");
    revalidatePath(`/collections/${existing.id}`);
    return { status: "success", message: "Đã lưu thay đổi khoản thu.", id: existing.id };
  } catch (error) {
    console.error("Không thể lưu khoản thu:", error);
    return { status: "error", message: "Không thể lưu khoản thu. Vui lòng thử lại." };
  }
}
