CREATE INDEX "admin_users_updated_at_id_idx" ON "admin_users"("updated_at" DESC, "id");
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at" DESC);
