-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_userId_fkey";

-- DropIndex
DROP INDEX "Team_domain_idx";

DROP INDEX "Team_stripeCustomerId_key";

DROP INDEX "Team_stripeSubscriptionId_key";

-- AlterTable
ALTER TABLE "Generation" DROP COLUMN "adminApproved",
DROP COLUMN "moderationDate",
DROP COLUMN "moderationPassed",
DROP COLUMN "moderationScore",
DROP COLUMN "outfitReferenceKey";

-- AlterTable
ALTER TABLE "Person" DROP COLUMN "inviteAcceptedAt",
DROP COLUMN "invitedAt";

-- AlterTable
ALTER TABLE "Selfie" DROP COLUMN "usedInGenerationId";

-- AlterTable
ALTER TABLE "Team" DROP COLUMN "activeSeats",
DROP COLUMN "domain",
DROP COLUMN "isLegacyCredits",
DROP COLUMN "stripeCustomerId",
DROP COLUMN "stripeSubscriptionId",
DROP COLUMN "subscriptionStatus";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "emailVerified";

-- DropTable
DROP TABLE "Transaction";
