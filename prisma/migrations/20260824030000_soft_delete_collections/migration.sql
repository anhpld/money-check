-- Keep session/member snapshots available to transaction history while hiding
-- deleted collections from all active collection and debt flows.
ALTER TABLE "FootballSession" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "FootballSession_deletedAt_idx" ON "FootballSession"("deletedAt");
