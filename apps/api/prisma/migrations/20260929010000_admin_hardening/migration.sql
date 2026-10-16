CREATE TABLE "admin_users" (
  "id" UUID NOT NULL, "name" VARCHAR(120) NOT NULL, "email" VARCHAR(240) NOT NULL,
  "role" VARCHAR(20) NOT NULL, "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");
CREATE INDEX "admin_users_role_status_idx" ON "admin_users"("role", "status");
CREATE TABLE "user_preferences" (
  "user_id" UUID NOT NULL, "theme" VARCHAR(20) NOT NULL DEFAULT 'dark',
  "density" VARCHAR(20) NOT NULL DEFAULT 'comfortable', "notifications" BOOLEAN NOT NULL DEFAULT true,
  "default_location" VARCHAR(40) NOT NULL DEFAULT 'beijing',
  "default_currency" VARCHAR(8) NOT NULL DEFAULT 'CNY',
  "updated_at" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id")
);
CREATE TABLE "dictionary_items" (
  "id" UUID NOT NULL, "group" VARCHAR(80) NOT NULL, "code" VARCHAR(80) NOT NULL,
  "label" VARCHAR(120) NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "dictionary_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "dictionary_items_group_code_key" ON "dictionary_items"("group", "code");
CREATE INDEX "dictionary_items_group_enabled_idx" ON "dictionary_items"("group", "enabled");
CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL, "actor_id" UUID NOT NULL, "action" VARCHAR(80) NOT NULL,
  "resource" VARCHAR(80) NOT NULL, "resource_id" VARCHAR(120),
  "request_id" VARCHAR(120) NOT NULL, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at" DESC);
CREATE INDEX "audit_logs_resource_created_at_idx" ON "audit_logs"("resource", "created_at" DESC);
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
