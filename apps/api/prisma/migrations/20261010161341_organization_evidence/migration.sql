-- AlterTable
ALTER TABLE "compensation_assumptions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "organization_units" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "region" VARCHAR(160),
    "role" VARCHAR(200),
    "status" VARCHAR(30) NOT NULL DEFAULT 'unverified',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organization_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_evidences" (
    "id" UUID NOT NULL,
    "organization_unit_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "excerpt" TEXT NOT NULL,
    "collected_at" TIMESTAMPTZ(3) NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "review_note" TEXT,
    "reviewed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organization_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_units_company_id_parent_id_idx" ON "organization_units"("company_id", "parent_id");

-- CreateIndex
CREATE INDEX "organization_units_company_id_status_updated_at_idx" ON "organization_units"("company_id", "status", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "organization_evidences_organization_unit_id_status_collecte_idx" ON "organization_evidences"("organization_unit_id", "status", "collected_at" DESC);

-- CreateIndex
CREATE INDEX "organization_evidences_source_id_collected_at_idx" ON "organization_evidences"("source_id", "collected_at" DESC);

-- AddForeignKey
ALTER TABLE "organization_units" ADD CONSTRAINT "organization_units_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_units" ADD CONSTRAINT "organization_units_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "organization_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_evidences" ADD CONSTRAINT "organization_evidences_organization_unit_id_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_evidences" ADD CONSTRAINT "organization_evidences_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
