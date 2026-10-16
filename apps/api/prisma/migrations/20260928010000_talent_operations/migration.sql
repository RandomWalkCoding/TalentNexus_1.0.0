CREATE TABLE "briefings" (
  "id" VARCHAR(80) NOT NULL,
  "intelligence_id" UUID NOT NULL,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "briefings_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "leads" (
  "id" VARCHAR(80) NOT NULL, "subject" VARCHAR(300) NOT NULL, "company" VARCHAR(200) NOT NULL,
  "stage" VARCHAR(40) NOT NULL, "owner" VARCHAR(120) NOT NULL, "score" INTEGER NOT NULL,
  "summary" TEXT NOT NULL, "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "talent_categories" (
  "name" VARCHAR(100) NOT NULL,
  CONSTRAINT "talent_categories_pkey" PRIMARY KEY ("name")
);
CREATE TABLE "talents" (
  "id" VARCHAR(80) NOT NULL, "name" VARCHAR(120) NOT NULL, "title" VARCHAR(200) NOT NULL,
  "company" VARCHAR(200) NOT NULL, "location" VARCHAR(120) NOT NULL, "category" VARCHAR(100) NOT NULL,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[], "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "talents_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "research_tasks" (
  "id" VARCHAR(80) NOT NULL, "name" VARCHAR(300) NOT NULL, "status" VARCHAR(40) NOT NULL,
  "progress" INTEGER NOT NULL, "owner" VARCHAR(120) NOT NULL, "target" VARCHAR(200) NOT NULL,
  "summary" TEXT NOT NULL, "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "research_tasks_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "outreach_campaigns" (
  "id" VARCHAR(80) NOT NULL, "name" VARCHAR(300) NOT NULL, "channel" VARCHAR(40) NOT NULL,
  "status" VARCHAR(40) NOT NULL, "touched" INTEGER NOT NULL, "replies" INTEGER NOT NULL,
  "summary" TEXT NOT NULL, "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "outreach_campaigns_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "mapping_items" (
  "id" VARCHAR(80) NOT NULL, "source" VARCHAR(300) NOT NULL, "target" VARCHAR(300) NOT NULL,
  "type" VARCHAR(40) NOT NULL, "confidence" INTEGER NOT NULL, "summary" TEXT NOT NULL,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "mapping_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "briefings_read_updated_at_idx" ON "briefings"("read", "updated_at" DESC);
CREATE INDEX "leads_stage_updated_at_idx" ON "leads"("stage", "updated_at" DESC);
CREATE INDEX "talents_category_updated_at_idx" ON "talents"("category", "updated_at" DESC);
CREATE INDEX "research_tasks_status_updated_at_idx" ON "research_tasks"("status", "updated_at" DESC);
CREATE INDEX "outreach_campaigns_status_updated_at_idx" ON "outreach_campaigns"("status", "updated_at" DESC);
CREATE INDEX "mapping_items_type_updated_at_idx" ON "mapping_items"("type", "updated_at" DESC);
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_intelligence_id_fkey" FOREIGN KEY ("intelligence_id") REFERENCES "intelligence_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "talents" ADD CONSTRAINT "talents_category_fkey" FOREIGN KEY ("category") REFERENCES "talent_categories"("name") ON DELETE RESTRICT ON UPDATE CASCADE;
