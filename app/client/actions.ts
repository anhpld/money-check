"use server";

import { randomBytes } from "node:crypto";
import { getPrisma } from "@/lib/prisma";

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
    if (existing) return serializeRequest(existing, true);

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

    const code = `PAY-${randomBytes(4).toString("hex").toUpperCase()}`;
    const request = await prisma.$transaction(async (transaction) => {
      for (const item of items) {
        await transaction.sessionMember.update({
          where: { id: item.sessionMemberId },
          data: { waterAmount: item.waterAmount },
        });
      }

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
    console.error("Không thể tạo payment request:", error);
    return { status: "error", message: "Không thể tạo mã thanh toán. Vui lòng thử lại." };
  }
}
