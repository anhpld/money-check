-- Keep only the newest active payment code for each user before enforcing the rule.
WITH "rankedPendingPayments" AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "userId"
            ORDER BY "createdAt" DESC, "id" DESC
        ) AS "position"
    FROM "PaymentRequest"
    WHERE "status" = 'PENDING'
)
UPDATE "PaymentRequest" AS "payment"
SET
    "status" = 'CANCELLED',
    "processedAt" = COALESCE("payment"."processedAt", CURRENT_TIMESTAMP),
    "updatedAt" = CURRENT_TIMESTAMP
FROM "rankedPendingPayments" AS "ranked"
WHERE "payment"."id" = "ranked"."id"
  AND "ranked"."position" > 1;

CREATE UNIQUE INDEX "PaymentRequest_one_pending_per_user_key"
ON "PaymentRequest"("userId")
WHERE "status" = 'PENDING';
