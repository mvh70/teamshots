-- CreateTable
CREATE TABLE "MobileHandoffToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "absoluteExpiry" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceId" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "MobileHandoffToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MobileHandoffToken_token_key" ON "MobileHandoffToken"("token");

-- CreateIndex
CREATE INDEX "MobileHandoffToken_token_idx" ON "MobileHandoffToken"("token");

-- CreateIndex
CREATE INDEX "MobileHandoffToken_userId_idx" ON "MobileHandoffToken"("userId");

-- CreateIndex
CREATE INDEX "MobileHandoffToken_expiresAt_idx" ON "MobileHandoffToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "MobileHandoffToken" ADD CONSTRAINT "MobileHandoffToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
