-- Make `location` required. Backfill any existing NULLs to an empty string
-- first so the NOT NULL constraint can be applied without failing.
UPDATE "Request" SET "location" = '' WHERE "location" IS NULL;
ALTER TABLE "Request" ALTER COLUMN "location" SET NOT NULL;
