CREATE TABLE "ChatReconciliation" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "groupRef" TEXT NOT NULL,
    "userId" TEXT,
    "retryAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChatReconciliation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ChatReconciliation_retryAt_id_idx" ON "ChatReconciliation"("retryAt", "id");
