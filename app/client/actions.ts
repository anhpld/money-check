"use server";

import { randomBytes } from "node:crypto";
import { Prisma } from "@/app/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

function generatePaymentCode() {
  return `PAY${randomBytes(4).toString("hex").toUpperCase()}`;
}

export type PaymentRequestResult =
  | {
      status: "success";
      request: {
        code: string;
        expectedAmount: number;
        reused: boolean;
        items: Array<{
          title: string;
          playedAt: string;
          expectedAmount: number;
        }>;
      };
    }
  | { status: "error"; message: string };

type CreatePaymentInput = {
  userId: string;
  sessions: Array<{
    sessionMemberId: string;
    options: Array<{ optionId: string; amount: number }>;
  }>;
};

type PaymentOptionSnapshot = { optionId: string | null; name: string; amount: number; sortOrder: number };
type PaymentItemSnapshot = {
  sessionMemberId: string;
  footballAmount: number;
  expectedAmount: number;
  options: PaymentOptionSnapshot[];
};

function matchesSnapshot(
  request: { code: string; expectedAmount: number; items: PaymentItemSnapshot[] },
  expectedAmount: number,
  items: PaymentItemSnapshot[],
) {
  const oldItems = new Map(request.items.map((item) => [item.sessionMemberId, item]));
  return /^PAY[A-F0-9]{8}$/.test(request.code)
    && request.expectedAmount === expectedAmount
    && request.items.length === items.length
    && items.every((item) => {
      const oldItem = oldItems.get(item.sessionMemberId);
      return oldItem?.footballAmount === item.footballAmount
        && oldItem.expectedAmount === item.expectedAmount
        && oldItem.options.length === item.options.length
        && item.options.every((option, index) => {
          const oldOption = oldItem.options[index];
          return oldOption?.optionId === option.optionId
            && oldOption.name === option.name
            && oldOption.amount === option.amount
            && oldOption.sortOrder === option.sortOrder;
        });
    });
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function serializeRequest(request: {
  code: string;
  expectedAmount: number;
  items: Array<{
    expectedAmount: number;
    sessionMember: { session: { title: string; playedAt: Date } };
  }>;
}, reused: boolean): PaymentRequestResult {
  return {
    status: "success",
    request: {
      code: request.code,
      expectedAmount: request.expectedAmount,
      reused,
      items: request.items.map((item) => ({
        title: item.sessionMember.session.title,
        playedAt: item.sessionMember.session.playedAt.toISOString(),
        expectedAmount: item.expectedAmount,
      })),
    },
  };
}

export async function createOrReusePaymentRequest(input: CreatePaymentInput): Promise<PaymentRequestResult> {
  if (!input.userId || !input.sessions.length) {
    return { status: "error", message: "Không có khoản nợ nào để thanh toán." };
  }

  const selectionsByMember = new Map<string, CreatePaymentInput["sessions"][number]["options"]>();
  for (const selection of input.sessions) {
    if (!selection.sessionMemberId || selectionsByMember.has(selection.sessionMemberId) || !Array.isArray(selection.options)) {
      return { status: "error", message: "Danh sách khoản thanh toán không hợp lệ." };
    }
    const optionIds = new Set<string>();
    for (const option of selection.options) {
      if (!option.optionId || optionIds.has(option.optionId) || !Number.isInteger(option.amount) || option.amount < 0) {
        return { status: "error", message: "Tùy chọn thanh toán không hợp lệ." };
      }
      optionIds.add(option.optionId);
    }
    selectionsByMember.set(selection.sessionMemberId, selection.options);
  }

  try {
    const prisma = getPrisma();
    const existing = await prisma.paymentRequest.findFirst({
      where: { userId: input.userId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          orderBy: { sessionMember: { session: { playedAt: "asc" } } },
          include: {
            options: { orderBy: { sortOrder: "asc" } },
            sessionMember: { include: { session: true } },
          },
        },
      },
    });
    const members = await prisma.sessionMember.findMany({
      where: {
        id: { in: [...selectionsByMember.keys()] },
        userId: input.userId,
        session: { status: "PUBLISHED", deletedAt: null },
      },
      orderBy: { session: { playedAt: "asc" } },
      include: {
        session: { include: { chargeOptions: { orderBy: { sortOrder: "asc" } } } },
        manualPaymentOptions: { select: { optionId: true } },
        paymentItems: {
          where: { paymentRequest: { status: "PAID" } },
          select: { options: { select: { optionId: true } } },
        },
      },
    });
    if (members.length !== selectionsByMember.size) {
      return { status: "error", message: "Danh sách buổi cần thanh toán không hợp lệ." };
    }

    const items = members.map((member) => {
      const footballAmount = Math.max(member.amountDue - member.amountPaid, 0);
      const availableOptions = new Map(member.session.chargeOptions.map((option) => [option.id, option]));
      const paidOptionIds = new Set([
        ...member.manualPaymentOptions.map((option) => option.optionId),
        ...member.paymentItems.flatMap((item) => item.options.map((option) => option.optionId)),
      ].filter((optionId): optionId is string => Boolean(optionId)));
      const selectedOptions = (selectionsByMember.get(member.id) ?? []).map((selection) => {
        const option = availableOptions.get(selection.optionId);
        if (!option) throw new Error("INVALID_OPTIONS");
        if (paidOptionIds.has(option.id)) throw new Error("OPTION_ALREADY_PAID");
        return {
          optionId: option.id,
          name: option.name,
          amount: option.allowCustomAmount ? selection.amount : option.defaultAmount,
          sortOrder: option.sortOrder,
        };
      }).sort((left, right) => left.sortOrder - right.sortOrder);
      const optionsAmount = selectedOptions.reduce((sum, option) => sum + option.amount, 0);
      return {
        sessionMemberId: member.id,
        footballAmount,
        expectedAmount: footballAmount + optionsAmount,
        options: selectedOptions,
      };
    }).filter((item) => item.expectedAmount > 0);
    const expectedAmount = items.reduce((sum, item) => sum + item.expectedAmount, 0);
    if (!expectedAmount) return { status: "error", message: "Các khoản của bạn đã được thanh toán." };

    if (existing) {
      if (matchesSnapshot(existing, expectedAmount, items)) return serializeRequest(existing, true);

      const code = generatePaymentCode();
      const newRequest = await prisma.$transaction(async (transaction) => {
        const cancelled = await transaction.paymentRequest.updateMany({
          where: { id: existing.id, status: "PENDING" },
          data: { status: "CANCELLED", processedAt: new Date() },
        });
        if (!cancelled.count) throw new Error("PAYMENT_REQUEST_NOT_PENDING");

        return transaction.paymentRequest.create({
          data: {
            userId: input.userId,
            code,
            expectedAmount,
            items: {
              create: items.map(({ options, ...item }) => ({ ...item, options: { create: options } })),
            },
          },
          include: {
            items: {
              orderBy: { sessionMember: { session: { playedAt: "asc" } } },
              include: {
                options: { orderBy: { sortOrder: "asc" } },
                sessionMember: { include: { session: true } },
              },
            },
          },
        });
      });

      return serializeRequest(newRequest, false);
    }

    const code = generatePaymentCode();
    try {
      const request = await prisma.$transaction(async (transaction) => {
        return transaction.paymentRequest.create({
          data: {
            userId: input.userId,
            code,
            expectedAmount,
            items: {
              create: items.map(({ options, ...item }) => ({ ...item, options: { create: options } })),
            },
          },
          include: {
            items: {
              orderBy: { sessionMember: { session: { playedAt: "asc" } } },
              include: {
                options: { orderBy: { sortOrder: "asc" } },
                sessionMember: { include: { session: true } },
              },
            },
          },
        });
      });

      return serializeRequest(request, false);
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;

      const concurrentRequest = await prisma.paymentRequest.findFirst({
        where: { userId: input.userId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            orderBy: { sessionMember: { session: { playedAt: "asc" } } },
            include: {
              options: { orderBy: { sortOrder: "asc" } },
              sessionMember: { include: { session: true } },
            },
          },
        },
      });
      if (concurrentRequest && matchesSnapshot(concurrentRequest, expectedAmount, items)) {
        return serializeRequest(concurrentRequest, true);
      }
      throw new Error("PAYMENT_REQUEST_CHANGED");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "OPTION_ALREADY_PAID") {
      return { status: "error", message: "Có tùy chọn đã được thanh toán trước đó. Vui lòng tải lại trang." };
    }
    if (error instanceof Error && error.message === "INVALID_OPTIONS") {
      return { status: "error", message: "Tùy chọn thanh toán không còn hợp lệ. Vui lòng tải lại trang." };
    }
    if (error instanceof Error && (error.message === "PAYMENT_REQUEST_NOT_PENDING" || error.message === "PAYMENT_REQUEST_CHANGED")) {
      return { status: "error", message: "Giao dịch vừa được xử lý. Vui lòng tải lại trang." };
    }
    console.error("Không thể tạo payment request:", error);
    return { status: "error", message: "Không thể tạo mã thanh toán. Vui lòng thử lại." };
  }
}
