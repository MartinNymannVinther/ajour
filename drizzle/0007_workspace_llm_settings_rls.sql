-- Security for the per-workspace model setting: the grant, forced RLS on
-- org_id, an audit trigger, and the encrypted key kept out of the audit
-- trail. See docs/adr/0009.

GRANT SELECT, INSERT, UPDATE, DELETE ON "workspace_llm_settings" TO ajour_app;
--> statement-breakpoint

ALTER TABLE "workspace_llm_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workspace_llm_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY app_tenant_workspace_llm_settings ON "workspace_llm_settings" FOR ALL TO ajour_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint

-- The audit trail records that a workspace changed its model and who did
-- it. The key itself is not part of that record: it is encrypted in the
-- table, and a second copy of the ciphertext in an append-only log is a
-- copy nobody can ever delete. The redaction list is the blanket one from
-- 0001, extended here rather than special-cased per table.
CREATE OR REPLACE FUNCTION audit_redact(data jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN data IS NULL THEN NULL
    ELSE data - ARRAY[
      'password', 'token', 'secret', 'backup_codes',
      'access_token', 'refresh_token', 'id_token', 'value',
      'key_hash', 'token_hash', 'api_key_cipher'
    ]
  END
$$;
--> statement-breakpoint

CREATE TRIGGER audit_workspace_llm_settings
  AFTER INSERT OR UPDATE OR DELETE ON "workspace_llm_settings"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
