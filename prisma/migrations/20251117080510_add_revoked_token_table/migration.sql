-- CreateTable
CREATE TABLE "RevokedToken" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevokedToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RevokedToken_jti_key" ON "RevokedToken"("jti");

-- CreateIndex
CREATE INDEX "RevokedToken_jti_idx" ON "RevokedToken"("jti");

-- CreateIndex
CREATE INDEX "RevokedToken_userId_idx" ON "RevokedToken"("userId");

-- CreateIndex
CREATE INDEX "RevokedToken_expiresAt_idx" ON "RevokedToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "RevokedToken" ADD CONSTRAINT "RevokedToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
