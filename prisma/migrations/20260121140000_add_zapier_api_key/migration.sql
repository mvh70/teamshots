-- CreateTable
CREATE TABLE "ZapierApiKey" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default',
    "lastUsedAt" TIMESTAMP(3),
    "lastUsedIp" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZapierApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ZapierApiKey_token_key" ON "ZapierApiKey"("token");

-- CreateIndex
CREATE INDEX "ZapierApiKey_teamId_idx" ON "ZapierApiKey"("teamId");

-- CreateIndex
CREATE INDEX "ZapierApiKey_token_idx" ON "ZapierApiKey"("token");

-- AddForeignKey
ALTER TABLE "ZapierApiKey" ADD CONSTRAINT "ZapierApiKey_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
