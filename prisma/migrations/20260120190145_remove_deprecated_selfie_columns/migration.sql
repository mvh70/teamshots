/*
  Warnings:

  - You are about to drop the column `ageCategory` on the `Selfie` table. All the data in the column will be lost.
  - You are about to drop the column `backgroundFeedback` on the `Selfie` table. All the data in the column will be lost.
  - You are about to drop the column `backgroundQuality` on the `Selfie` table. All the data in the column will be lost.
  - You are about to drop the column `ethnicity` on the `Selfie` table. All the data in the column will be lost.
  - You are about to drop the column `gender` on the `Selfie` table. All the data in the column will be lost.
  - You are about to drop the column `improperReason` on the `Selfie` table. All the data in the column will be lost.
  - You are about to drop the column `isProper` on the `Selfie` table. All the data in the column will be lost.
  - You are about to drop the column `lightingFeedback` on the `Selfie` table. All the data in the column will be lost.
  - You are about to drop the column `lightingQuality` on the `Selfie` table. All the data in the column will be lost.
  - You are about to drop the column `personCount` on the `Selfie` table. All the data in the column will be lost.
  - You are about to drop the column `selfieType` on the `Selfie` table. All the data in the column will be lost.
  - You are about to drop the column `selfieTypeConfidence` on the `Selfie` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Selfie_selfieType_idx";

-- AlterTable
ALTER TABLE "Selfie" DROP COLUMN "ageCategory",
DROP COLUMN "backgroundFeedback",
DROP COLUMN "backgroundQuality",
DROP COLUMN "ethnicity",
DROP COLUMN "gender",
DROP COLUMN "improperReason",
DROP COLUMN "isProper",
DROP COLUMN "lightingFeedback",
DROP COLUMN "lightingQuality",
DROP COLUMN "personCount",
DROP COLUMN "selfieType",
DROP COLUMN "selfieTypeConfidence";
