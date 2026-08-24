"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-session";
import type { CollectionActionResult, PaidBreakdown, SaveCollectionInput } from "@/app/collections/types";

export type ManualPaymentResult =
  | { status: "success"; message: string; amountPaid: number; manualPaidAt: string | null; paidBreakdown: PaidBreakdown }
  | { status: "error"; message: string };

const relevantPaymentStatuses = ["PAID", "REVIEW_REQUIRED"] as const;

type ManualOptionSelection = { optionId: string; amount: number };

function buildPaidBreakdown(
  footballAmount: number,
  options: Array<{ name: string; amount: number }>,
): PaidBreakdown {
  const optionAmounts = new Map<string, number>();
  for (const option of options) {
    optionAmounts.set(option.name, (optionAmounts.get(option.name) ?? 0) + option.amount);
  }
  return {
    footballAmount,
    options: [...optionAmounts].map(([name, amount]) => ({ name, amount })),
  };
}

export async function markMemberPaidManually(
  sessionMemberId: string,
  selections: ManualOptionSelection[],
): Promise<ManualPaymentResult> {
  if (!(await isAdminAuthenticated())) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  if (!sessionMemberId) return { status: "error", message: "Khoản thanh toán không hợp lệ." };
  if (!Array.isArray(selections)) return { status: "error", message: "Danh sách tùy chọn thanh toán không hợp lệ." };

  try {
    const prisma = getPrisma();
    const result = await prisma.$transaction(async (transaction) => {
      const member = await transaction.sessionMember.findUnique({
        where: { id: sessionMemberId },
        include: {
          session: {
            select: {
              id: true,
              status: true,
              deletedAt: true,
              chargeOptions: { orderBy: { sortOrder: "asc" } },
            },
          },
          manualPaymentOptions: { orderBy: { sortOrder: "asc" } },
          paymentItems: {
            where: { paymentRequest: { status: { in: [...relevantPaymentStatuses] } } },
            select: {
              footballAmount: true,
              paymentRequest: { select: { status: true } },
              options: { select: { optionId: true, name: true, amount: true } },
            },
          },
        },
      });

      if (!member) throw new Error("MEMBER_NOT_FOUND");
      if (member.session.deletedAt) throw new Error("COLLECTION_DELETED");
      if (member.session.status === "DRAFT") throw new Error("SESSION_NOT_PUBLISHED");
      if (member.paymentItems.some((item) => item.paymentRequest.status === "REVIEW_REQUIRED")) {
        throw new Error("PAYMENT_NEEDS_REVIEW");
      }

      const paidPaymentItems = member.paymentItems.filter((item) => item.paymentRequest.status === "PAID");
      const existingFootballPaid = paidPaymentItems.reduce(
        (sum, item) => sum + item.footballAmount,
        member.manualFootballAmount ?? 0,
      );
      const existingPaidOptions = [
        ...paidPaymentItems.flatMap((item) => item.options),
        ...member.manualPaymentOptions,
      ];
      const paidOptionIds = new Set(
        existingPaidOptions.map((option) => option.optionId).filter((optionId): optionId is string => Boolean(optionId)),
      );
      const existingPaidOptionsTotal = existingPaidOptions.reduce((sum, option) => sum + option.amount, 0);
      const totalPaid = member.amountPaid + existingPaidOptionsTotal;

      if (totalPaid >= member.amountDue) {
        return {
          amountPaid: member.amountPaid,
          manualPaidAt: member.manualPaidAt,
          paidBreakdown: buildPaidBreakdown(existingFootballPaid, existingPaidOptions),
          sessionId: member.session.id,
          alreadyPaid: true,
        };
      }

      const optionsById = new Map(member.session.chargeOptions.map((option) => [option.id, option]));
      const selectedIds = new Set<string>();
      const selectedOptions = selections.map((selection) => {
        if (!selection.optionId || selectedIds.has(selection.optionId)) throw new Error("INVALID_OPTIONS");
        const option = optionsById.get(selection.optionId);
        if (!option || !Number.isInteger(selection.amount) || selection.amount < 0) throw new Error("INVALID_OPTIONS");
        if (paidOptionIds.has(option.id)) throw new Error("OPTION_ALREADY_PAID");
        selectedIds.add(selection.optionId);
        return {
          optionId: option.id,
          name: option.name,
          amount: option.allowCustomAmount ? selection.amount : option.defaultAmount,
          sortOrder: option.sortOrder,
        };
      });

      await transaction.paymentRequest.updateMany({
        where: {
          status: "PENDING",
          items: { some: { sessionMemberId: member.id } },
        },
        data: { status: "CANCELLED" },
      });

      const footballAmount = Math.max(member.amountDue - totalPaid, 0);
      const updated = await transaction.sessionMember.update({
        where: { id: member.id },
        data: {
          amountPaid: member.amountPaid + footballAmount,
          manualPaidAt: new Date(),
          manualFootballAmount: (member.manualFootballAmount ?? 0) + footballAmount,
          manualPaymentOptions: { create: selectedOptions },
        },
        select: { amountPaid: true, manualPaidAt: true },
      });

      return {
        amountPaid: updated.amountPaid,
        manualPaidAt: updated.manualPaidAt,
        paidBreakdown: buildPaidBreakdown(
          existingFootballPaid + footballAmount,
          [...existingPaidOptions, ...selectedOptions],
        ),
        sessionId: member.session.id,
        alreadyPaid: false,
      };
    });

    revalidatePath("/admin/collections");
    revalidatePath(`/admin/collections/${result.sessionId}`);
    revalidatePath("/client");
    return {
      status: "success",
      message: result.alreadyPaid ? "Khoản này đã được thanh toán trước đó." : "Đã ghi nhận thanh toán tiền mặt.",
      amountPaid: result.amountPaid,
      manualPaidAt: result.manualPaidAt?.toISOString() ?? null,
      paidBreakdown: result.paidBreakdown,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "MEMBER_NOT_FOUND") return { status: "error", message: "Không tìm thấy người trong khoản thu." };
      if (error.message === "COLLECTION_DELETED") return { status: "error", message: "Khoản thu này đã bị xóa." };
      if (error.message === "SESSION_NOT_PUBLISHED") return { status: "error", message: "Hãy public khoản thu trước khi ghi nhận thanh toán." };
      if (error.message === "PAYMENT_NEEDS_REVIEW") {
        return { status: "error", message: "Người này đang có giao dịch cần kiểm tra. Hãy xử lý giao dịch đó trước." };
      }
      if (error.message === "INVALID_OPTIONS") return { status: "error", message: "Danh sách tùy chọn thanh toán không hợp lệ." };
      if (error.message === "OPTION_ALREADY_PAID") {
        return { status: "error", message: "Có tùy chọn đã được thanh toán trước đó. Vui lòng tải lại trang." };
      }
    }
    console.error("Không thể ghi nhận thanh toán thủ công:", error);
    return { status: "error", message: "Không thể ghi nhận thanh toán. Vui lòng thử lại." };
  }
}

export async function deleteCollection(id: string): Promise<CollectionActionResult> {
  if (!(await isAdminAuthenticated())) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  if (!id) return { status: "error", message: "Không tìm thấy khoản thu cần xóa." };

  try {
    const prisma = getPrisma();
    const deletedTitle = await prisma.$transaction(async (transaction) => {
      const session = await transaction.footballSession.findUnique({
        where: { id },
        select: { title: true, deletedAt: true },
      });
      if (!session || session.deletedAt) throw new Error("COLLECTION_NOT_FOUND");

      await transaction.paymentRequest.updateMany({
        where: {
          status: "PENDING",
          items: { some: { sessionMember: { sessionId: id } } },
        },
        data: { status: "CANCELLED", processedAt: new Date() },
      });
      await transaction.footballSession.update({
        where: { id },
        data: { status: "CLOSED", deletedAt: new Date() },
      });
      return session.title;
    });

    revalidatePath("/admin/collections");
    revalidatePath("/client");
    return { status: "success", message: `Đã xóa khoản thu ${deletedTitle}.` };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "COLLECTION_NOT_FOUND") return { status: "error", message: "Khoản thu không còn tồn tại." };
    }
    console.error("Không thể xóa khoản thu:", error);
    return { status: "error", message: "Không thể xóa khoản thu. Vui lòng thử lại." };
  }
}

function validateCollection(input: SaveCollectionInput): string | null {
  if (input.title.trim().length < 3) return "Tên buổi bóng cần có ít nhất 3 ký tự.";
  if (!input.playedAt || Number.isNaN(new Date(input.playedAt).getTime())) return "Ngày đá bóng không hợp lệ.";
  if (!Number.isInteger(input.totalAmount) || input.totalAmount <= 0) return "Tổng tiền phải lớn hơn 0.";
  if (!Array.isArray(input.members) || !input.members.length) return "Cần chọn ít nhất một người tham gia.";
  if (!Array.isArray(input.chargeOptions)) return "Danh sách tùy chọn không hợp lệ.";

  const optionIds = new Set<string>();
  const optionNames = new Set<string>();
  for (const option of input.chargeOptions) {
    const normalizedName = option.name.trim().toLocaleLowerCase("vi-VN");
    if (!option.id || option.id.length > 200 || optionIds.has(option.id)) return "Danh sách tùy chọn không hợp lệ.";
    if (!normalizedName || option.name.trim().length > 100 || optionNames.has(normalizedName)) return "Tên tùy chọn không hợp lệ hoặc bị trùng.";
    if (!Number.isInteger(option.defaultAmount) || option.defaultAmount < 0) return "Số tiền mặc định của tùy chọn không hợp lệ.";
    if (typeof option.autoSelected !== "boolean" || typeof option.allowCustomAmount !== "boolean") return "Cấu hình tùy chọn không hợp lệ.";
    optionIds.add(option.id);
    optionNames.add(normalizedName);
  }

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
          chargeOptions: {
            create: input.chargeOptions.map((option, sortOrder) => ({
              id: option.id,
              name: option.name.trim(),
              defaultAmount: option.defaultAmount,
              autoSelected: option.autoSelected,
              allowCustomAmount: option.allowCustomAmount,
              sortOrder,
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

    const existing = await prisma.footballSession.findFirst({
      where: { id: input.id, deletedAt: null },
      include: { members: true, chargeOptions: true },
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
          status: nextStatus,
          publishedAt: existing.publishedAt ?? (nextStatus === "PUBLISHED" ? new Date() : null),
        },
      });

      const incomingOptionIds = new Set(input.chargeOptions.map((option) => option.id));
      await transaction.sessionChargeOption.deleteMany({
        where: { sessionId: existing.id, id: { notIn: [...incomingOptionIds] } },
      });
      const existingOptionIds = new Set(existing.chargeOptions.map((option) => option.id));
      for (const option of input.chargeOptions) {
        if (existingOptionIds.has(option.id)) {
          await transaction.sessionChargeOption.update({
            where: { id: option.id },
            data: { name: `__updating__${option.id}` },
          });
        }
      }
      for (const [sortOrder, option] of input.chargeOptions.entries()) {
        const data = {
          name: option.name.trim(),
          defaultAmount: option.defaultAmount,
          autoSelected: option.autoSelected,
          allowCustomAmount: option.allowCustomAmount,
          sortOrder,
        };
        if (existingOptionIds.has(option.id)) {
          await transaction.sessionChargeOption.update({ where: { id: option.id }, data });
        } else {
          await transaction.sessionChargeOption.create({ data: { id: option.id, sessionId: existing.id, ...data } });
        }
      }

      for (const current of existing.members) {
        const incoming = incomingByUser.get(current.userId);
        if (!incoming) {
          await transaction.sessionMember.delete({ where: { id: current.id } });
          continue;
        }

        await transaction.sessionMember.update({
          where: { id: current.id },
          data: { slots: incoming.slots, amountDue: incoming.amountDue, note: incoming.note.trim() || null },
        });
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
