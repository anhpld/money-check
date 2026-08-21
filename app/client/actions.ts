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
  sessions: Array<{ sessionMemberId: string; waterAmount: number }>;
};

type PaymentItemSnapshot = {
  sessionMemberId: string;
  footballAmount: number;
  waterAmount: number;
  expectedAmount: number;
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
        && oldItem.waterAmount === item.waterAmount
        && oldItem.expectedAmount === item.expectedAmount;
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

  const waterByMember = new Map<string, number>();
  for (const selection of input.sessions) {
    if (!selection.sessionMemberId || !Number.isInteger(selection.waterAmount) || selection.waterAmount < 0) {
      return { status: "error", message: "Số tiền nước không hợp lệ." };
    }
    waterByMember.set(selection.sessionMemberId, selection.waterAmount);
  }

  try {
    const prisma = getPrisma();
    const existing = await prisma.paymentRequest.findFirst({
      where: { userId: input.userId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          orderBy: { sessionMember: { session: { playedAt: "asc" } } },
          include: { sessionMember: { include: { session: true } } },
        },
      },
    });
    const members = await prisma.sessionMember.findMany({
      where: {
        id: { in: [...waterByMember.keys()] },
        userId: input.userId,
        session: { status: "PUBLISHED" },
      },
      orderBy: { session: { playedAt: "asc" } },
      include: { session: true },
    });
    if (members.length !== waterByMember.size) {
      return { status: "error", message: "Danh sách buổi cần thanh toán không hợp lệ." };
    }

    const items = members.map((member) => {
      const footballAmount = Math.max(member.amountDue - member.amountPaid, 0);
      const waterAmount = waterByMember.get(member.id) ?? 0;
      return {
        sessionMemberId: member.id,
        footballAmount,
        waterAmount,
        expectedAmount: footballAmount + waterAmount,
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
            items: { create: items },
          },
          include: {
            items: {
              orderBy: { sessionMember: { session: { playedAt: "asc" } } },
              include: { sessionMember: { include: { session: true } } },
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
            items: { create: items },
          },
          include: {
            items: {
              orderBy: { sessionMember: { session: { playedAt: "asc" } } },
              include: { sessionMember: { include: { session: true } } },
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
            include: { sessionMember: { include: { session: true } } },
          },
        },
      });
      if (concurrentRequest && matchesSnapshot(concurrentRequest, expectedAmount, items)) {
        return serializeRequest(concurrentRequest, true);
      }
      throw new Error("PAYMENT_REQUEST_CHANGED");
    }
  } catch (error) {
    if (error instanceof Error && (error.message === "PAYMENT_REQUEST_NOT_PENDING" || error.message === "PAYMENT_REQUEST_CHANGED")) {
      return { status: "error", message: "Giao dịch vừa được xử lý. Vui lòng tải lại trang." };
    }
    console.error("Không thể tạo payment request:", error);
    return { status: "error", message: "Không thể tạo mã thanh toán. Vui lòng thử lại." };
  }
}
