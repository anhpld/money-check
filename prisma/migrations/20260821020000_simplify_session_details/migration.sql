-- AlterTable
ALTER TABLE "FootballSession" DROP COLUMN "location";
ALTER TABLE "FootballSession" ALTER COLUMN "playedAt" TYPE DATE USING "playedAt"::date;
