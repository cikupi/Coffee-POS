-- AlterEnum
ALTER TYPE "public"."PaymentType" ADD VALUE 'DEPOSIT';

-- AlterTable
ALTER TABLE "public"."Customer" ADD COLUMN     "deposit" DECIMAL(10,2) NOT NULL DEFAULT 0;
