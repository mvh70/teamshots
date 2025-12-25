-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "activeSeats" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "creditsPerSeat" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "isLegacyCredits" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totalSeats" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SeatPurchase" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "seatsPurchased" INTEGER NOT NULL,
    "pricePerSeat" DOUBLE PRECISION NOT NULL,
    "totalPaid" DOUBLE PRECISION NOT NULL,
    "stripePaymentId" TEXT NOT NULL,
    "stripePriceId" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeatPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeatPurchase_stripePaymentId_key" ON "SeatPurchase"("stripePaymentId");

-- CreateIndex
CREATE INDEX "SeatPurchase_teamId_idx" ON "SeatPurchase"("teamId");

-- CreateIndex
CREATE INDEX "SeatPurchase_purchasedAt_idx" ON "SeatPurchase"("purchasedAt");

-- AddForeignKey
ALTER TABLE "SeatPurchase" ADD CONSTRAINT "SeatPurchase_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
