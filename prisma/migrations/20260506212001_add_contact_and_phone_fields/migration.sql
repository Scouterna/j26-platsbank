-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactPhone" TEXT;

-- AlterTable
ALTER TABLE "RequestSignup" ADD COLUMN     "phone" TEXT;
