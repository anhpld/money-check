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
