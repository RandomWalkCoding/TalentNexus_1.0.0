CREATE TABLE "compensation_assumptions" (
    "location" VARCHAR(40) NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "currency" VARCHAR(8) NOT NULL,
    "fx_to_cny" DECIMAL(18,8) NOT NULL,
    "tax_rate" DECIMAL(8,6) NOT NULL,
    "mandatory_rate" DECIMAL(8,6) NOT NULL,
    "employer_rate" DECIMAL(8,6) NOT NULL,
    "ppp_factor" DECIMAL(8,6) NOT NULL,
    "effective_from" VARCHAR(10) NOT NULL,
    "notes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "version" VARCHAR(80) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "compensation_assumptions_pkey" PRIMARY KEY ("location")
);

CREATE INDEX "compensation_assumptions_version_effective_from_idx"
    ON "compensation_assumptions"("version", "effective_from");
