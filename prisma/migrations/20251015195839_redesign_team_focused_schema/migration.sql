/*
  Warnings:

  - You are about to drop the column `backgroundOption` on the `Generation` table. All the data in the column will be lost.
  - You are about to drop the column `customPrompt` on the `Generation` table. All the data in the column will be lost.
  - You are about to drop the column `stylePreset` on the `Generation` table. All the data in the column will be lost.
  - You are about to drop the column `uploadedPhotoUrl` on the `Generation` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Generation` table. All the data in the column will be lost.
  - You are about to drop the column `variations` on the `Generation` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `subscriptionPeriod` on the `User` table. All the data in the column will be lost.
  - Added the required column `personId` to the `Generation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `uploadedPhotoKey` to the `Generation` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Generation" DROP CONSTRAINT "Generation_userId_fkey";

-- DropIndex
DROP INDEX "public"."Generation_userId_idx";

-- AlterTable
ALTER TABLE "Generation" DROP COLUMN "backgroundOption",
DROP COLUMN "customPrompt",
DROP COLUMN "stylePreset",
DROP COLUMN "uploadedPhotoUrl",
DROP COLUMN "userId",
DROP COLUMN "variations",
ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "acceptedPhotoKey" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "contextId" TEXT,
ADD COLUMN     "generatedPhotoKeys" TEXT[],
ADD COLUMN     "personId" TEXT NOT NULL,
ADD COLUMN     "regenerationCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "uploadedPhotoKey" TEXT NOT NULL,
ALTER COLUMN "creditsUsed" SET DEFAULT 4,
ALTER COLUMN "actualCost" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "image",
DROP COLUMN "name",
DROP COLUMN "subscriptionPeriod",
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'user';

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT,
    "userId" TEXT,
    "companyId" TEXT,
    "inviteToken" TEXT,
    "invitedAt" TIMESTAMP(3),
    "inviteAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "domain" TEXT,
    "adminId" TEXT NOT NULL,
    "subscriptionTier" TEXT,
    "subscriptionStatus" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Context" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" TEXT,
    "userId" TEXT,
    "backgroundUrl" TEXT,
    "backgroundPrompt" TEXT,
    "logoUrl" TEXT,
    "stylePreset" TEXT NOT NULL,
    "customPrompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Context_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "OTP" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OTP_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_userId_key" ON "Person"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Person_inviteToken_key" ON "Person"("inviteToken");

-- CreateIndex
CREATE INDEX "Person_email_idx" ON "Person"("email");

-- CreateIndex
CREATE INDEX "Person_companyId_idx" ON "Person"("companyId");

-- CreateIndex
CREATE INDEX "Person_inviteToken_idx" ON "Person"("inviteToken");

-- CreateIndex
CREATE INDEX "Person_userId_idx" ON "Person"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_stripeCustomerId_key" ON "Company"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_stripeSubscriptionId_key" ON "Company"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Company_adminId_idx" ON "Company"("adminId");

-- CreateIndex
CREATE INDEX "Company_domain_idx" ON "Company"("domain");

-- CreateIndex
CREATE INDEX "Context_companyId_idx" ON "Context"("companyId");

-- CreateIndex
CREATE INDEX "Context_userId_idx" ON "Context"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "OTP_email_idx" ON "OTP"("email");

-- CreateIndex
CREATE INDEX "OTP_code_idx" ON "OTP"("code");

-- CreateIndex
CREATE INDEX "OTP_expires_idx" ON "OTP"("expires");

-- CreateIndex
CREATE INDEX "Generation_personId_idx" ON "Generation"("personId");

-- CreateIndex
CREATE INDEX "Generation_contextId_idx" ON "Generation"("contextId");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Context" ADD CONSTRAINT "Context_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "Context"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
