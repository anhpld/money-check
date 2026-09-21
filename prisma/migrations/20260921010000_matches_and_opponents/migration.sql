-- Separate sporting participation from financial collection membership while
-- preserving every existing collection, member and payment reference.

CREATE TABLE "Opponent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Opponent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "playedAt" DATE NOT NULL,
    "opponentId" TEXT,
    "ourScore" INTEGER,
    "opponentScore" INTEGER,
    "note" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MatchParticipant" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slots" INTEGER NOT NULL DEFAULT 1,
    "isFeeExempt" BOOLEAN NOT NULL DEFAULT false,
    "exemptionReason" TEXT,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MatchParticipant_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FootballSession" ADD COLUMN "matchId" TEXT;

-- Every existing football collection represents one historical match. Reuse
-- its UUID for the match so the migration is deterministic and reversible.
INSERT INTO "Match" ("id", "playedAt", "note", "deletedAt", "createdAt", "updatedAt")
SELECT "id", "playedAt", "note", "deletedAt", "createdAt", "updatedAt"
FROM "FootballSession";

UPDATE "FootballSession" SET "matchId" = "id";

-- Existing selected members count as participants. A zero obligation is
-- migrated as an explicit exemption; payment history remains on SessionMember.
INSERT INTO "MatchParticipant" (
    "id", "matchId", "userId", "slots", "isFeeExempt", "createdAt", "updatedAt"
)
SELECT
    "id", "sessionId", "userId", "slots", ("amountDue" = 0), "createdAt", "updatedAt"
FROM "SessionMember";

CREATE UNIQUE INDEX "Opponent_name_key" ON "Opponent"("name");
CREATE INDEX "Match_playedAt_idx" ON "Match"("playedAt");
CREATE INDEX "Match_opponentId_idx" ON "Match"("opponentId");
CREATE INDEX "Match_deletedAt_idx" ON "Match"("deletedAt");
CREATE UNIQUE INDEX "FootballSession_matchId_key" ON "FootballSession"("matchId");
CREATE UNIQUE INDEX "MatchParticipant_matchId_userId_key" ON "MatchParticipant"("matchId", "userId");
CREATE INDEX "MatchParticipant_userId_idx" ON "MatchParticipant"("userId");

ALTER TABLE "Match" ADD CONSTRAINT "Match_opponentId_fkey"
FOREIGN KEY ("opponentId") REFERENCES "Opponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MatchParticipant" ADD CONSTRAINT "MatchParticipant_matchId_fkey"
FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatchParticipant" ADD CONSTRAINT "MatchParticipant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FootballSession" ADD CONSTRAINT "FootballSession_matchId_fkey"
FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
