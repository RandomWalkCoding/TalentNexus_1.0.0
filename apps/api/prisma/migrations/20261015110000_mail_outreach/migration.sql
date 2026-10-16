-- CreateTable
CREATE TABLE "mail_connections" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "email" VARCHAR(254),
    "status" VARCHAR(30) NOT NULL DEFAULT 'connecting',
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "credentials" TEXT,
    "expiresAt" TIMESTAMPTZ(3),
    "lastSyncedAt" TIMESTAMPTZ(3),
    "cursor" TEXT,
    "errorCode" VARCHAR(40),
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastDispatchAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mail_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_oauth_states" (
    "stateHash" VARCHAR(64) NOT NULL,
    "ownerId" UUID NOT NULL,
    "sessionHash" VARCHAR(64) NOT NULL,
    "connectionId" UUID NOT NULL,
    "connectionVersion" INTEGER NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "verifier" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mail_oauth_states_pkey" PRIMARY KEY ("stateHash")
);

-- CreateTable
CREATE TABLE "mail_messages" (
    "id" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "talentId" VARCHAR(80) NOT NULL,
    "projectId" UUID,
    "candidateProjectId" UUID,
    "campaignId" VARCHAR(80),
    "recipient" VARCHAR(254) NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "sentAt" TIMESTAMPTZ(3),
    "nextAttemptAt" TIMESTAMPTZ(3),
    "scheduledAt" TIMESTAMPTZ(3),
    "leaseUntil" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mail_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_replies" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "providerId" VARCHAR(500) NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mail_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_inbound" (
    "id" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "providerId" VARCHAR(500) NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mail_inbound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_feedback" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "replyId" UUID,
    "kind" VARCHAR(30) NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "actorId" UUID,
    "note" TEXT,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mail_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_suppressions" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "talentId" VARCHAR(80),
    "reason" VARCHAR(30) NOT NULL,
    "sourceReplyId" UUID,
    "createdBy" UUID,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mail_suppressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_previews" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mail_previews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_operations" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "operation" VARCHAR(160) NOT NULL,
    "digest" VARCHAR(64) NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mail_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_sync_jobs" (
    "id" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'queued',
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "unassociatedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" VARCHAR(40),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "leaseUntil" TIMESTAMPTZ(3),

    CONSTRAINT "mail_sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_audit" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "resourceId" UUID NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "detail" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mail_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mail_connections_ownerId_status_idx" ON "mail_connections"("ownerId", "status");

-- CreateIndex
CREATE INDEX "mail_oauth_states_expiresAt_idx" ON "mail_oauth_states"("expiresAt");

-- CreateIndex
CREATE INDEX "mail_messages_ownerId_updatedAt_idx" ON "mail_messages"("ownerId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "mail_messages_status_nextAttemptAt_idx" ON "mail_messages"("status", "nextAttemptAt");

CREATE INDEX "mail_messages_scheduledAt_idx" ON "mail_messages"("scheduledAt");

-- CreateIndex
CREATE INDEX "mail_messages_recipient_sentAt_idx" ON "mail_messages"("recipient", "sentAt");

-- CreateIndex
CREATE INDEX "mail_messages_talentId_sentAt_idx" ON "mail_messages"("talentId", "sentAt");

-- CreateIndex
CREATE INDEX "mail_replies_receivedAt_idx" ON "mail_replies"("receivedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "mail_replies_connectionId_providerId_key" ON "mail_replies"("connectionId", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "mail_inbound_connectionId_providerId_key" ON "mail_inbound"("connectionId", "providerId");

-- CreateIndex
CREATE INDEX "mail_feedback_messageId_kind_idx" ON "mail_feedback"("messageId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "mail_suppressions_email_key" ON "mail_suppressions"("email");

-- CreateIndex
CREATE INDEX "mail_suppressions_talentId_idx" ON "mail_suppressions"("talentId");

-- CreateIndex
CREATE INDEX "mail_previews_expiresAt_idx" ON "mail_previews"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "mail_operations_actorId_key_operation_key" ON "mail_operations"("actorId", "key", "operation");

-- CreateIndex
CREATE INDEX "mail_sync_jobs_status_createdAt_idx" ON "mail_sync_jobs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "mail_audit_resourceId_createdAt_idx" ON "mail_audit"("resourceId", "createdAt");

-- AddForeignKey
ALTER TABLE "mail_connections" ADD CONSTRAINT "mail_connections_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_messages" ADD CONSTRAINT "mail_messages_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "mail_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_messages" ADD CONSTRAINT "mail_messages_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "talents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_messages" ADD CONSTRAINT "mail_messages_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "search_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_messages" ADD CONSTRAINT "mail_messages_candidateProjectId_fkey" FOREIGN KEY ("candidateProjectId") REFERENCES "candidate_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_messages" ADD CONSTRAINT "mail_messages_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "outreach_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_replies" ADD CONSTRAINT "mail_replies_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "mail_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_replies" ADD CONSTRAINT "mail_replies_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "mail_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_inbound" ADD CONSTRAINT "mail_inbound_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "mail_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_feedback" ADD CONSTRAINT "mail_feedback_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "mail_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_sync_jobs" ADD CONSTRAINT "mail_sync_jobs_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "mail_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
