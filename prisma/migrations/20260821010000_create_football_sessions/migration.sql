-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PaymentRequestStatus" AS ENUM ('PENDING', 'UNDERPAID', 'PAID', 'OVERPAID');

-- CreateTable
CREATE TABLE "FootballSession" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "totalAmount" INTEGER NOT NULL,
    "note" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FootballSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionMember" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountDue" INTEGER NOT NULL,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SessionMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeAdjustment" (
    "id" TEXT NOT NULL,
    "sessionMemberId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChargeAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL,
    "sessionMemberId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expectedAmount" INTEGER NOT NULL,
    "actualAmount" INTEGER,
    "fullContent" TEXT,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionMember_userId_idx" ON "SessionMember"("userId");
CREATE UNIQUE INDEX "SessionMember_sessionId_userId_key" ON "SessionMember"("sessionId", "userId");
CREATE INDEX "ChargeAdjustment_sessionMemberId_idx" ON "ChargeAdjustment"("sessionMemberId");
CREATE UNIQUE INDEX "PaymentRequest_code_key" ON "PaymentRequest"("code");
CREATE INDEX "PaymentRequest_sessionMemberId_status_idx" ON "PaymentRequest"("sessionMemberId", "status");

-- AddForeignKey
ALTER TABLE "SessionMember" ADD CONSTRAINT "SessionMember_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "FootballSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionMember" ADD CONSTRAINT "SessionMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChargeAdjustment" ADD CONSTRAINT "ChargeAdjustment_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "SessionMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "SessionMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
