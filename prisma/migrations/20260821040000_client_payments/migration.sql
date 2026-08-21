-- Add configurable water amounts
ALTER TABLE "FootballSession" ADD COLUMN "defaultWaterAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SessionMember" ADD COLUMN "waterAmount" INTEGER;

-- Move payment requests from a single session member to a user
ALTER TABLE "PaymentRequest" ADD COLUMN "userId" TEXT;
UPDATE "PaymentRequest" AS request
SET "userId" = member."userId"
FROM "SessionMember" AS member
WHERE request."sessionMemberId" = member."id";
ALTER TABLE "PaymentRequest" ALTER COLUMN "userId" SET NOT NULL;
DROP INDEX "PaymentRequest_sessionMemberId_status_idx";
ALTER TABLE "PaymentRequest" DROP CONSTRAINT "PaymentRequest_sessionMemberId_fkey";
ALTER TABLE "PaymentRequest" DROP COLUMN "sessionMemberId";

-- Payment request line items allow one QR to cover multiple sessions
CREATE TABLE "PaymentRequestItem" (
    "id" TEXT NOT NULL,
    "paymentRequestId" TEXT NOT NULL,
    "sessionMemberId" TEXT NOT NULL,
    "footballAmount" INTEGER NOT NULL,
    "waterAmount" INTEGER NOT NULL DEFAULT 0,
    "expectedAmount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentRequestItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentRequest_userId_status_idx" ON "PaymentRequest"("userId", "status");
CREATE INDEX "PaymentRequestItem_sessionMemberId_idx" ON "PaymentRequestItem"("sessionMemberId");
CREATE UNIQUE INDEX "PaymentRequestItem_paymentRequestId_sessionMemberId_key" ON "PaymentRequestItem"("paymentRequestId", "sessionMemberId");

ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRequestItem" ADD CONSTRAINT "PaymentRequestItem_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentRequestItem" ADD CONSTRAINT "PaymentRequestItem_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "SessionMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
