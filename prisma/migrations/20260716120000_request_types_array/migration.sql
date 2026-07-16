-- Replace the single `type` column with a `types` array so a request can
-- target more than one audience (leader and/or staff).

-- AlterTable: add the new array column
ALTER TABLE "Request" ADD COLUMN "types" TEXT[] NOT NULL DEFAULT ARRAY['leader']::TEXT[];

-- Backfill: each existing request's single type becomes a one-element array
UPDATE "Request" SET "types" = ARRAY["type"];

-- Drop the old single-value column
ALTER TABLE "Request" DROP COLUMN "type";
