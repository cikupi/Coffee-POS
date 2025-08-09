-- AlterTable
ALTER TABLE "public"."OrderItem" ADD COLUMN     "cost" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."Variant" ADD COLUMN     "cost" DECIMAL(10,2) NOT NULL DEFAULT 0;
