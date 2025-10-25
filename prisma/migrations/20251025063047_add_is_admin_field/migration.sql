-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Migrate existing admin users
UPDATE "User" SET "isAdmin" = true WHERE "role" = 'admin';

-- Update role field to remove 'admin' option (convert admin role to user)
UPDATE "User" SET "role" = 'user' WHERE "role" = 'admin';
