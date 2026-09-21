-- Bring sporting metadata back into the collection that owns its payments.
-- MATCH collections count towards football statistics; GENERAL collections do not.

CREATE TYPE "CollectionKind" AS ENUM ('MATCH', 'GENERAL');

ALTER TABLE "FootballSession"
ADD COLUMN "kind" "CollectionKind" NOT NULL DEFAULT 'MATCH',
ADD COLUMN "opponentId" TEXT,
ADD COLUMN "ourScore" INTEGER,
ADD COLUMN "opponentScore" INTEGER;

ALTER TABLE "SessionMember"
ADD COLUMN "isFeeExempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "exemptionReason" TEXT,
ADD COLUMN "goals" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "assists" INTEGER NOT NULL DEFAULT 0;

UPDATE "FootballSession" AS session_row
SET
    "opponentId" = match_row."opponentId",
    "ourScore" = match_row."ourScore",
    "opponentScore" = match_row."opponentScore"
FROM "Match" AS match_row
WHERE session_row."matchId" = match_row."id";

UPDATE "SessionMember" AS member_row
SET
    "isFeeExempt" = participant_row."isFeeExempt",
    "exemptionReason" = participant_row."exemptionReason",
    "goals" = participant_row."goals",
    "assists" = participant_row."assists"
FROM "MatchParticipant" AS participant_row, "FootballSession" AS session_row
WHERE member_row."sessionId" = session_row."id"
  AND session_row."matchId" = participant_row."matchId"
  AND member_row."userId" = participant_row."userId";

-- Preserve the original convention for any financial member that did not have
-- a participant row for an unexpected reason.
UPDATE "SessionMember"
SET "isFeeExempt" = true
WHERE "amountDue" = 0;

ALTER TABLE "FootballSession" DROP CONSTRAINT "FootballSession_matchId_fkey";
DROP INDEX "FootballSession_matchId_key";
ALTER TABLE "FootballSession" DROP COLUMN "matchId";

DROP TABLE "MatchParticipant";
DROP TABLE "Match";

CREATE INDEX "FootballSession_kind_playedAt_idx" ON "FootballSession"("kind", "playedAt");
CREATE INDEX "FootballSession_opponentId_idx" ON "FootballSession"("opponentId");

ALTER TABLE "FootballSession" ADD CONSTRAINT "FootballSession_opponentId_fkey"
FOREIGN KEY ("opponentId") REFERENCES "Opponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
