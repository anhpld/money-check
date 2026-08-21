ALTER TABLE "SessionMember" ADD COLUMN "manualPaidAt" TIMESTAMP(3);

UPDATE "SessionMember" AS member
SET "manualPaidAt" = member."updatedAt"
WHERE member."amountPaid" >= member."amountDue"
  AND member."amountPaid" > 0
  AND NOT EXISTS (
    SELECT 1
    FROM "PaymentRequestItem" AS item
    INNER JOIN "PaymentRequest" AS payment ON payment."id" = item."paymentRequestId"
    WHERE item."sessionMemberId" = member."id"
      AND payment."status" = 'PAID'
  );
