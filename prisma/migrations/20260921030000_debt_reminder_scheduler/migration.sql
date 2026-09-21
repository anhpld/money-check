CREATE TYPE "DebtReminderRunStatus" AS ENUM ('RUNNING', 'SENT', 'SKIPPED', 'FAILED');

CREATE TABLE "DebtReminderSchedule" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "days" INTEGER[] NOT NULL,
    "times" TEXT[] NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DebtReminderSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DebtReminderRun" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "DebtReminderRunStatus" NOT NULL DEFAULT 'RUNNING',
    "debtorCount" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "DebtReminderRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DebtReminderRun_scheduleId_scheduledFor_key"
ON "DebtReminderRun"("scheduleId", "scheduledFor");

CREATE INDEX "DebtReminderRun_createdAt_idx" ON "DebtReminderRun"("createdAt");

ALTER TABLE "DebtReminderRun" ADD CONSTRAINT "DebtReminderRun_scheduleId_fkey"
FOREIGN KEY ("scheduleId") REFERENCES "DebtReminderSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
