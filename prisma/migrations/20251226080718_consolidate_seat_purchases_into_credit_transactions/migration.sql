/*
  Warnings:

  - You are about to drop the `SeatPurchase` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "SeatPurchase" DROP CONSTRAINT "SeatPurchase_teamId_fkey";

-- AlterTable
ALTER TABLE "CreditTransaction" ADD COLUMN     "pricePerSeat" DOUBLE PRECISION,
ADD COLUMN     "seats" INTEGER,
ADD COLUMN     "stripePriceId" TEXT;

-- DropTable
DROP TABLE "SeatPurchase";

-- CreateIndex
CREATE INDEX "CreditTransaction_seats_idx" ON "CreditTransaction"("seats");
