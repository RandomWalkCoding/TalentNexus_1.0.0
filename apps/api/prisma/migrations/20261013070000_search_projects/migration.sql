-- CreateTable
CREATE TABLE "search_projects" (
    "id" UUID NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "company_id" UUID,
    "target_role" VARCHAR(120) NOT NULL,
    "regions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "owner" VARCHAR(120) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
    "target_count" INTEGER NOT NULL DEFAULT 0,
    "deadline" VARCHAR(10),
    "summary" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "search_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_projects" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "talent_id" VARCHAR(80) NOT NULL,
    "stage" VARCHAR(40) NOT NULL DEFAULT 'research',
    "source" VARCHAR(120),
    "next_action_at" TIMESTAMPTZ(3),
    "feedback" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "candidate_projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_projects_company_id_status_updated_at_idx" ON "search_projects"("company_id", "status", "updated_at" DESC);
CREATE INDEX "search_projects_status_updated_at_idx" ON "search_projects"("status", "updated_at" DESC);
CREATE UNIQUE INDEX "candidate_projects_project_id_talent_id_key" ON "candidate_projects"("project_id", "talent_id");
CREATE INDEX "candidate_projects_talent_id_updated_at_idx" ON "candidate_projects"("talent_id", "updated_at" DESC);
CREATE INDEX "candidate_projects_project_id_stage_updated_at_idx" ON "candidate_projects"("project_id", "stage", "updated_at" DESC);

-- AddForeignKey
ALTER TABLE "search_projects" ADD CONSTRAINT "search_projects_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "candidate_projects" ADD CONSTRAINT "candidate_projects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "search_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_projects" ADD CONSTRAINT "candidate_projects_talent_id_fkey" FOREIGN KEY ("talent_id") REFERENCES "talents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
