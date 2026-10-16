CREATE TABLE "ai_tasks" (
  "id" UUID NOT NULL,
  "kind" VARCHAR(60) NOT NULL,
  "status" VARCHAR(30) NOT NULL,
  "input_ref" VARCHAR(240) NOT NULL,
  "model" VARCHAR(120) NOT NULL,
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL,
  "error_code" VARCHAR(40),
  "error_message" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMPTZ(3),
  "finished_at" TIMESTAMPTZ(3),
  CONSTRAINT "ai_tasks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ai_tasks_status_created_at_idx" ON "ai_tasks"("status", "created_at" DESC);
CREATE TABLE "ai_reviews" (
  "id" UUID NOT NULL,
  "task_id" UUID NOT NULL,
  "entity_type" VARCHAR(40) NOT NULL,
  "entity_id" VARCHAR(120) NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "proposed" JSONB NOT NULL,
  "evidence_ids" UUID[] NOT NULL,
  "reviewer_id" UUID,
  "review_note" TEXT,
  "reviewed_at" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_reviews_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "ai_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ai_reviews_status_created_at_idx" ON "ai_reviews"("status", "created_at" DESC);
CREATE TABLE "macro_snapshots" (
  "id" UUID NOT NULL,
  "metric" VARCHAR(30) NOT NULL,
  "source" VARCHAR(160) NOT NULL,
  "source_url" TEXT NOT NULL,
  "license" VARCHAR(160) NOT NULL,
  "version" VARCHAR(100) NOT NULL,
  "published_at" TIMESTAMPTZ(3) NOT NULL,
  "valid_from" VARCHAR(10) NOT NULL,
  "valid_until" VARCHAR(10) NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "observations" JSONB NOT NULL,
  "checksum" VARCHAR(160) NOT NULL,
  "supersedes_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "macro_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "macro_snapshots_metric_version_key" UNIQUE ("metric", "version")
);
CREATE INDEX "macro_snapshots_metric_status_published_at_idx" ON "macro_snapshots"("metric", "status", "published_at" DESC);
