-- AlterTable
ALTER TABLE "research_tasks" ADD COLUMN     "company_id" UUID;

-- CreateTable
CREATE TABLE "leader_profiles" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "organization_unit_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "current_title" VARCHAR(200),
    "previous_titles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "regions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "team_summary" TEXT,
    "contact_channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" VARCHAR(30) NOT NULL DEFAULT 'unverified',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leader_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leader_evidences" (
    "id" UUID NOT NULL,
    "leader_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "excerpt" TEXT NOT NULL,
    "collected_at" TIMESTAMPTZ(3) NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leader_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_task_leaders" (
    "research_task_id" VARCHAR(80) NOT NULL,
    "leader_id" UUID NOT NULL,
    "added_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_task_leaders_pkey" PRIMARY KEY ("research_task_id","leader_id")
);

-- CreateIndex
CREATE INDEX "leader_profiles_company_id_name_idx" ON "leader_profiles"("company_id", "name");

-- CreateIndex
CREATE INDEX "leader_profiles_organization_unit_id_status_idx" ON "leader_profiles"("organization_unit_id", "status");

-- CreateIndex
CREATE INDEX "leader_evidences_leader_id_status_collected_at_idx" ON "leader_evidences"("leader_id", "status", "collected_at" DESC);

-- CreateIndex
CREATE INDEX "research_task_leaders_leader_id_idx" ON "research_task_leaders"("leader_id");

-- AddForeignKey
ALTER TABLE "leader_profiles" ADD CONSTRAINT "leader_profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_profiles" ADD CONSTRAINT "leader_profiles_organization_unit_id_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_evidences" ADD CONSTRAINT "leader_evidences_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "leader_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_evidences" ADD CONSTRAINT "leader_evidences_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_tasks" ADD CONSTRAINT "research_tasks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_task_leaders" ADD CONSTRAINT "research_task_leaders_research_task_id_fkey" FOREIGN KEY ("research_task_id") REFERENCES "research_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_task_leaders" ADD CONSTRAINT "research_task_leaders_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "leader_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
