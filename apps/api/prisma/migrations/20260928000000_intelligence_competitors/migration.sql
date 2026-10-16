-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "IntelligenceKind" AS ENUM ('industry', 'company');

-- CreateEnum
CREATE TYPE "IntelligenceImportance" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "MonitorSignalKind" AS ENUM ('funding', 'hiring', 'other');

-- CreateTable
CREATE TABLE "sources" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "url" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "industry" VARCHAR(120) NOT NULL,
    "region" VARCHAR(160) NOT NULL,
    "employee_count" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intelligence_items" (
    "id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "summary" VARCHAR(1000) NOT NULL,
    "content" TEXT NOT NULL,
    "kind" "IntelligenceKind" NOT NULL,
    "importance" "IntelligenceImportance" NOT NULL DEFAULT 'medium',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "published_at" TIMESTAMPTZ(3) NOT NULL,
    "source_id" UUID NOT NULL,
    "company_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "intelligence_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_monitors" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "monitored" BOOLEAN NOT NULL DEFAULT true,
    "last_updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "competitor_monitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitor_signals" (
    "id" UUID NOT NULL,
    "monitor_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "kind" "MonitorSignalKind" NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "summary" VARCHAR(1000) NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "monitor_signals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sources_name_key" ON "sources"("name");

-- CreateIndex
CREATE UNIQUE INDEX "companies_name_key" ON "companies"("name");

-- CreateIndex
CREATE INDEX "intelligence_items_published_at_idx" ON "intelligence_items"("published_at" DESC);

-- CreateIndex
CREATE INDEX "intelligence_items_kind_published_at_idx" ON "intelligence_items"("kind", "published_at" DESC);

-- CreateIndex
CREATE INDEX "intelligence_items_importance_published_at_idx" ON "intelligence_items"("importance", "published_at" DESC);

-- CreateIndex
CREATE INDEX "intelligence_items_source_id_published_at_idx" ON "intelligence_items"("source_id", "published_at" DESC);

-- CreateIndex
CREATE INDEX "intelligence_items_company_id_published_at_idx" ON "intelligence_items"("company_id", "published_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "competitor_monitors_company_id_key" ON "competitor_monitors"("company_id");

-- CreateIndex
CREATE INDEX "competitor_monitors_monitored_last_updated_at_idx" ON "competitor_monitors"("monitored", "last_updated_at" DESC);

-- CreateIndex
CREATE INDEX "monitor_signals_monitor_id_occurred_at_idx" ON "monitor_signals"("monitor_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "monitor_signals_source_id_occurred_at_idx" ON "monitor_signals"("source_id", "occurred_at" DESC);

-- AddForeignKey
ALTER TABLE "intelligence_items" ADD CONSTRAINT "intelligence_items_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_items" ADD CONSTRAINT "intelligence_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_monitors" ADD CONSTRAINT "competitor_monitors_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitor_signals" ADD CONSTRAINT "monitor_signals_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "competitor_monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitor_signals" ADD CONSTRAINT "monitor_signals_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
