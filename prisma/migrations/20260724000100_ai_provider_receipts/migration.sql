CREATE TABLE "ai_provider_receipts" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerRequestId" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_provider_receipts_pkey" PRIMARY KEY("id")
);
CREATE UNIQUE INDEX "ai_provider_receipts_provider_providerRequestId_key" ON "ai_provider_receipts"("provider","providerRequestId");
CREATE INDEX "ai_provider_receipts_userId_createdAt_idx" ON "ai_provider_receipts"("userId","createdAt");
ALTER TABLE "ai_provider_receipts" ADD CONSTRAINT "ai_provider_receipts_userId_fkey" FOREIGN KEY("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
