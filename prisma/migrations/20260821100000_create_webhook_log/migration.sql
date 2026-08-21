CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebhookLog_createdAt_idx" ON "WebhookLog"("createdAt");
