-- AlterTable
ALTER TABLE "OrderMapping" ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "customerPhone" TEXT,
ADD COLUMN     "isPaidOnline" BOOLEAN NOT NULL DEFAULT false;
