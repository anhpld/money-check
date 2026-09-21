import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export function getPrisma() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL chưa được cấu hình.");
  }

  // Prisma's singleton survives Next.js development hot reloads. Replace an
  // older generated client that was cached before the Setting model existed.
  const cachedPrisma = globalForPrisma.prisma;
  const cachedHasCurrentModels = cachedPrisma
    ? Boolean((cachedPrisma as unknown as { setting?: unknown; opponent?: unknown; debtReminderSchedule?: unknown }).setting)
      && Boolean((cachedPrisma as unknown as { opponent?: unknown }).opponent)
      && Boolean((cachedPrisma as unknown as { debtReminderSchedule?: unknown }).debtReminderSchedule)
    : false;
  if (cachedPrisma && !cachedHasCurrentModels) {
    void cachedPrisma.$disconnect();
    globalForPrisma.prisma = undefined;
  }

  if (!globalForPrisma.prisma) {
    const adapter = new PrismaPg(
      {
        connectionString,
        connectionTimeoutMillis: 5_000,
      },
      { schema: process.env.DATABASE_SCHEMA ?? "public" },
    );
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }

  return globalForPrisma.prisma;
}
