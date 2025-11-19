-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "generationId" TEXT,
    "type" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "comment" TEXT,
    "context" TEXT NOT NULL,
    "options" JSONB,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feedback_userId_idx" ON "Feedback"("userId");

-- CreateIndex
CREATE INDEX "Feedback_generationId_idx" ON "Feedback"("generationId");

-- CreateIndex
CREATE INDEX "Feedback_type_idx" ON "Feedback"("type");

-- CreateIndex
CREATE INDEX "Feedback_rating_idx" ON "Feedback"("rating");

-- CreateIndex
CREATE INDEX "Feedback_resolved_idx" ON "Feedback"("resolved");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- CreateIndex
CREATE INDEX "Feedback_context_idx" ON "Feedback"("context");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
