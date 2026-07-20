-- Add mandatory English translations for the poster-authored content fields.
-- Existing rows have only Swedish, so add the columns with a temporary empty
-- default, backfill English from the Swedish source (per product decision:
-- copy Swedish into English now), then drop the default so the columns match
-- the schema (NOT NULL, no default). New rows always provide both languages.
ALTER TABLE "Request" ADD COLUMN "titleEn" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Request" ADD COLUMN "descriptionEn" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Request" ADD COLUMN "locationEn" TEXT NOT NULL DEFAULT '';

UPDATE "Request"
SET "titleEn" = "title",
    "descriptionEn" = "description",
    "locationEn" = "location";

ALTER TABLE "Request" ALTER COLUMN "titleEn" DROP DEFAULT;
ALTER TABLE "Request" ALTER COLUMN "descriptionEn" DROP DEFAULT;
ALTER TABLE "Request" ALTER COLUMN "locationEn" DROP DEFAULT;
