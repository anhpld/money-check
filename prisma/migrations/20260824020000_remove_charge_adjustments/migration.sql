-- Charge adjustments were an unused audit log. SessionMember.amountDue remains
-- the source of truth for the total football amount a member must pay.
DROP TABLE "ChargeAdjustment";
