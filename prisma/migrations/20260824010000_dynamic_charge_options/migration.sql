-- Generalize the former water-only setting into reusable per-session options.
CREATE TABLE "SessionChargeOption" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultAmount" INTEGER NOT NULL,
    "autoSelected" BOOLEAN NOT NULL DEFAULT false,
    "allowCustomAmount" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SessionChargeOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentRequestItemOption" (
    "id" TEXT NOT NULL,
    "paymentRequestItemId" TEXT NOT NULL,
    "optionId" TEXT,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentRequestItemOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ManualPaymentOption" (
    "id" TEXT NOT NULL,
    "sessionMemberId" TEXT NOT NULL,
    "optionId" TEXT,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ManualPaymentOption_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SessionMember" ADD COLUMN "manualFootballAmount" INTEGER;

CREATE UNIQUE INDEX "SessionChargeOption_sessionId_name_key" ON "SessionChargeOption"("sessionId", "name");
CREATE INDEX "SessionChargeOption_sessionId_sortOrder_idx" ON "SessionChargeOption"("sessionId", "sortOrder");
CREATE INDEX "PaymentRequestItemOption_paymentRequestItemId_sortOrder_idx" ON "PaymentRequestItemOption"("paymentRequestItemId", "sortOrder");
CREATE INDEX "PaymentRequestItemOption_optionId_idx" ON "PaymentRequestItemOption"("optionId");
CREATE INDEX "ManualPaymentOption_sessionMemberId_sortOrder_idx" ON "ManualPaymentOption"("sessionMemberId", "sortOrder");
CREATE INDEX "ManualPaymentOption_optionId_idx" ON "ManualPaymentOption"("optionId");

ALTER TABLE "SessionChargeOption" ADD CONSTRAINT "SessionChargeOption_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "FootballSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentRequestItemOption" ADD CONSTRAINT "PaymentRequestItemOption_paymentRequestItemId_fkey" FOREIGN KEY ("paymentRequestItemId") REFERENCES "PaymentRequestItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentRequestItemOption" ADD CONSTRAINT "PaymentRequestItemOption_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "SessionChargeOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManualPaymentOption" ADD CONSTRAINT "ManualPaymentOption_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "SessionMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManualPaymentOption" ADD CONSTRAINT "ManualPaymentOption_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "SessionChargeOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve the existing water configuration and historical payment snapshots.
INSERT INTO "SessionChargeOption" (
    "id", "sessionId", "name", "defaultAmount", "autoSelected", "allowCustomAmount", "sortOrder", "createdAt", "updatedAt"
)
SELECT
    'legacy-water-' || "id", "id", 'Tiền nước', "defaultWaterAmount", true, true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "FootballSession";

INSERT INTO "PaymentRequestItemOption" (
    "id", "paymentRequestItemId", "optionId", "name", "amount", "sortOrder", "createdAt"
)
SELECT
    'legacy-water-item-' || item."id",
    item."id",
    'legacy-water-' || member."sessionId",
    'Tiền nước',
    item."waterAmount",
    0,
    item."createdAt"
FROM "PaymentRequestItem" AS item
JOIN "SessionMember" AS member ON member."id" = item."sessionMemberId"
WHERE item."waterAmount" > 0;

-- amountPaid now represents paid football money only. Optional money lives in snapshots.
UPDATE "SessionMember" AS member
SET "amountPaid" = CASE
    WHEN member."manualPaidAt" IS NOT NULL THEN LEAST(member."amountPaid", member."amountDue")
    ELSE COALESCE((
        SELECT SUM(item."footballAmount")
        FROM "PaymentRequestItem" AS item
        JOIN "PaymentRequest" AS request ON request."id" = item."paymentRequestId"
        WHERE item."sessionMemberId" = member."id" AND request."status" = 'PAID'
    ), LEAST(member."amountPaid", member."amountDue"))
END;

UPDATE "SessionMember"
SET "manualFootballAmount" = "amountPaid"
WHERE "manualPaidAt" IS NOT NULL;

ALTER TABLE "PaymentRequestItem" DROP COLUMN "waterAmount";
ALTER TABLE "FootballSession" DROP COLUMN "defaultWaterAmount";
