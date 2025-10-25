/*
  Warnings:

  - Added the required column `credits` to the `CreditTransaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CreditTransaction" ADD COLUMN     "credits" INTEGER NOT NULL,
ADD COLUMN     "currency" TEXT DEFAULT 'USD',
ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "planPeriod" TEXT,
ADD COLUMN     "planTier" TEXT,
ADD COLUMN     "stripeInvoiceId" TEXT,
ADD COLUMN     "stripePaymentId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ALTER COLUMN "amount" DROP NOT NULL,
ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "CreditTransaction_stripePaymentId_idx" ON "CreditTransaction"("stripePaymentId");

-- CreateIndex
CREATE INDEX "CreditTransaction_stripeSubscriptionId_idx" ON "CreditTransaction"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "CreditTransaction_planTier_idx" ON "CreditTransaction"("planTier");
