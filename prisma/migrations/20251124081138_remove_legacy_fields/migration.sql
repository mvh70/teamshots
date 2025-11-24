/*
  Warnings:

  - You are about to drop the column `backgroundPrompt` on the `Context` table. All the data in the column will be lost.
  - You are about to drop the column `backgroundUrl` on the `Context` table. All the data in the column will be lost.
  - You are about to drop the column `logoUrl` on the `Context` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Context" DROP COLUMN "backgroundPrompt",
DROP COLUMN "backgroundUrl",
DROP COLUMN "logoUrl";
