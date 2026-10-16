CREATE TABLE "compensation_samples" (
  "id" UUID PRIMARY KEY, "company" VARCHAR(120) NOT NULL, "role" VARCHAR(120) NOT NULL,
  "location" VARCHAR(40) NOT NULL, "currency" VARCHAR(8) NOT NULL, "level_code" VARCHAR(20) NOT NULL,
  "series" VARCHAR(8) NOT NULL, "sample_date" VARCHAR(10) NOT NULL, "source" VARCHAR(200) NOT NULL,
  "source_url" TEXT NOT NULL, "license" VARCHAR(200) NOT NULL,
  "base" DECIMAL(18,2) NOT NULL CHECK ("base" >= 0),
  "bonus_target" DECIMAL(18,2), "bonus_actual" DECIMAL(18,2), "equity" DECIMAL(18,2),
  "allowances" DECIMAL(18,2), "statutory_benefits" DECIMAL(18,2), "extra_benefits" DECIMAL(18,2), "employer_taxes" DECIMAL(18,2),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "compensation_samples_location_level_code_role_sample_date_idx" ON "compensation_samples"("location", "level_code", "role", "sample_date");
CREATE TABLE "level_benchmarks" (
  "id" UUID PRIMARY KEY, "company" VARCHAR(120) NOT NULL, "role" VARCHAR(120) NOT NULL,
  "location" VARCHAR(40) NOT NULL, "series" VARCHAR(8) NOT NULL, "external_level" VARCHAR(40) NOT NULL,
  "candidate_levels" TEXT[] NOT NULL, "confidence" INTEGER NOT NULL CHECK ("confidence" BETWEEN 0 AND 100),
  "evidence_url" TEXT, "rationale" TEXT NOT NULL, "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "selected_level" VARCHAR(20), "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "level_benchmarks_company_location_series_status_idx" ON "level_benchmarks"("company", "location", "series", "status");
CREATE TABLE "level_benchmark_reviews" (
  "id" UUID PRIMARY KEY, "benchmark_id" UUID NOT NULL REFERENCES "level_benchmarks"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "version" INTEGER NOT NULL, "status" VARCHAR(20) NOT NULL, "selected_level" VARCHAR(20),
  "note" TEXT NOT NULL, "actor_id" UUID NOT NULL, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "level_benchmark_reviews_benchmark_id_version_key" ON "level_benchmark_reviews"("benchmark_id", "version");
CREATE TABLE "benchmark_snapshots" (
  "id" UUID PRIMARY KEY, "kind" VARCHAR(40) NOT NULL, "payload" JSONB NOT NULL, "actor_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "benchmark_snapshots_kind_created_at_idx" ON "benchmark_snapshots"("kind", "created_at" DESC);
