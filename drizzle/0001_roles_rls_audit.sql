-- The foundation's security model in one migration: runtime roles,
-- least-privilege grants, row-level security on every table, the append-only
-- audit log with its triggers, and the admission tables' confinement. This is
-- the Haij foundation (docs/adr/0001) applied to Ajour; the reasoning lives in
-- docs/adr/0002 (tenancy), 0003 (audit) and 0004 (admission).
--
-- Roles are created NOLOGIN if missing so this migration is self-contained;
-- provisioning (scripts/ensure-roles.ts, docker/postgres-init/01-roles.sh)
-- sets LOGIN and passwords. Migrations must run as a superuser (docs/deploy.md).

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ajour_app') THEN
    CREATE ROLE ajour_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ajour_auth') THEN
    CREATE ROLE ajour_auth NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO ajour_app, ajour_auth;
--> statement-breakpoint

-- Better Auth owns the auth tables and is the only writer of them. The
-- admission tables have no org_id: they describe people who are not users
-- yet and keys that let one address register, so they belong to the
-- installation like the auth tables and are reachable the same way - the
-- auth role gets them in full, the application role not at all.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "users", "sessions", "accounts", "verifications",
  "organizations", "memberships", "invitations",
  "passkeys", "two_factors", "rate_limits",
  "access_requests", "access_invitations"
TO ajour_auth;
--> statement-breakpoint
GRANT INSERT ON "audit_log" TO ajour_auth;
--> statement-breakpoint

-- The application role gets narrow read access plus audit inserts. It has
-- deliberately no access at all to accounts, sessions, verifications,
-- passkeys, two_factors, rate_limits or the admission tables: domain code
-- can never touch password hashes, session tokens, TOTP secrets or
-- invitation keys.
GRANT SELECT ON "users", "organizations", "memberships" TO ajour_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON "audit_log" TO ajour_app;
--> statement-breakpoint

-- Tenant context helpers. current_setting(..., true) returns NULL when the
-- setting is absent, so a missing context matches no rows: default deny.
CREATE OR REPLACE FUNCTION app_current_org_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.org_id', true), '')
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')
$$;
--> statement-breakpoint

-- RLS on, and forced so not even the table owner is exempt (superusers
-- always bypass RLS; no runtime role is a superuser).
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "accounts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "verifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "verifications" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "invitations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "passkeys" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "passkeys" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "two_factors" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "two_factors" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "rate_limits" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_log" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "access_requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "access_requests" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "access_invitations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "access_invitations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Better Auth needs unrestricted access to its own tables (login happens
-- before any org context exists). The role is confined by grants instead:
-- it cannot see any domain table.
CREATE POLICY auth_all_users ON "users" FOR ALL TO ajour_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_all_sessions ON "sessions" FOR ALL TO ajour_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_all_accounts ON "accounts" FOR ALL TO ajour_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_all_verifications ON "verifications" FOR ALL TO ajour_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_all_organizations ON "organizations" FOR ALL TO ajour_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_all_memberships ON "memberships" FOR ALL TO ajour_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_all_invitations ON "invitations" FOR ALL TO ajour_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_all_passkeys ON "passkeys" FOR ALL TO ajour_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_all_two_factors ON "two_factors" FOR ALL TO ajour_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_all_rate_limits ON "rate_limits" FOR ALL TO ajour_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_all_access_requests ON "access_requests" FOR ALL TO ajour_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_all_access_invitations ON "access_invitations" FOR ALL TO ajour_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_insert_audit ON "audit_log" FOR INSERT TO ajour_auth WITH CHECK (true);
--> statement-breakpoint

-- Application role policies: a user sees themselves, the organizations they
-- are a member of, and rows belonging to the active organization. Without a
-- context every predicate is NULL and nothing matches.
CREATE POLICY app_select_self ON "users" FOR SELECT TO ajour_app
  USING (id = app_current_user_id());
--> statement-breakpoint
CREATE POLICY app_select_memberships ON "memberships" FOR SELECT TO ajour_app
  USING (
    user_id = app_current_user_id()
    OR organization_id = app_current_org_id()
  );
--> statement-breakpoint
CREATE POLICY app_select_organizations ON "organizations" FOR SELECT TO ajour_app
  USING (
    id = app_current_org_id()
    OR id IN (
      SELECT organization_id FROM "memberships"
      WHERE user_id = app_current_user_id()
    )
  );
--> statement-breakpoint
CREATE POLICY app_select_audit ON "audit_log" FOR SELECT TO ajour_app
  USING (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_insert_audit ON "audit_log" FOR INSERT TO ajour_app
  WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint

-- Audit logging: database triggers capture before/after for every row
-- mutation, and audit_log is made append-only at the database level.

-- Strips secrets from row images before they enter the audit trail. The key
-- list is deliberately a blanket list applied to every table.
CREATE OR REPLACE FUNCTION audit_redact(data jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN data IS NULL THEN NULL
    ELSE data - ARRAY[
      'password', 'token', 'secret', 'backup_codes',
      'access_token', 'refresh_token', 'id_token', 'value',
      'key_hash', 'token_hash'
    ]
  END
$$;
--> statement-breakpoint

-- Row-change capture. SECURITY DEFINER (owned by the migration superuser)
-- so the insert into audit_log is possible no matter which confined role
-- triggered the change. Actor and org come from the transaction-local
-- context; context-less writes (auth, migrations, system jobs) fall back to
-- the row's own tenant column - `org_id` on domain tables,
-- `organization_id` on the auth tables - and actor_type 'system'.
CREATE OR REPLACE FUNCTION audit_row_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org text := nullif(current_setting('app.org_id', true), '');
  v_actor text := nullif(current_setting('app.user_id', true), '');
  v_before jsonb;
  v_after jsonb;
  v_entity_id text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  ELSE
    v_before := to_jsonb(OLD);
  END IF;

  IF v_org IS NULL THEN
    v_org := coalesce(
      v_after ->> 'org_id',
      v_before ->> 'org_id',
      v_after ->> 'organization_id',
      v_before ->> 'organization_id'
    );
    IF v_org IS NULL AND TG_TABLE_NAME = 'organizations' THEN
      v_org := coalesce(v_after ->> 'id', v_before ->> 'id');
    END IF;
  END IF;

  v_entity_id := coalesce(v_after ->> 'id', v_before ->> 'id');

  INSERT INTO audit_log (
    org_id, actor_user_id, actor_type, action,
    entity_type, entity_id, before_data, after_data
  )
  VALUES (
    v_org,
    v_actor,
    CASE WHEN v_actor IS NULL THEN 'system' ELSE 'user' END,
    TG_TABLE_NAME || '.' || lower(TG_OP),
    TG_TABLE_NAME,
    v_entity_id,
    audit_redact(v_before),
    audit_redact(v_after)
  );

  RETURN COALESCE(NEW, OLD);
END
$$;
--> statement-breakpoint

-- Append-only enforcement: rejects UPDATE/DELETE/TRUNCATE for every role,
-- superusers included. Grants already withhold UPDATE/DELETE from the
-- runtime roles; this trigger is the backstop.
CREATE OR REPLACE FUNCTION audit_block_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END
$$;
--> statement-breakpoint
CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION audit_block_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON "audit_log"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_block_mutation();
--> statement-breakpoint

-- Row-change triggers on every business-meaningful table. sessions,
-- verifications and rate_limits are technical, high-churn tables and are
-- excluded; logins/logouts are recorded as semantic events instead
-- (src/core/audit/events.ts). The admission tables are covered by semantic
-- events too, because their rows hold personal data about people who are
-- not users. The trade-off is recorded in ADR 0003.
CREATE TRIGGER audit_users
  AFTER INSERT OR UPDATE OR DELETE ON "users"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint
CREATE TRIGGER audit_accounts
  AFTER INSERT OR UPDATE OR DELETE ON "accounts"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint
CREATE TRIGGER audit_organizations
  AFTER INSERT OR UPDATE OR DELETE ON "organizations"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint
CREATE TRIGGER audit_memberships
  AFTER INSERT OR UPDATE OR DELETE ON "memberships"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint
CREATE TRIGGER audit_invitations
  AFTER INSERT OR UPDATE OR DELETE ON "invitations"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint
CREATE TRIGGER audit_passkeys
  AFTER INSERT OR UPDATE OR DELETE ON "passkeys"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint
CREATE TRIGGER audit_two_factors
  AFTER INSERT OR UPDATE OR DELETE ON "two_factors"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint

-- Let the application read Drizzle's own migration journal. The About page
-- compares the number of migrations the build was made from with the number
-- the database has applied, so a deploy where the container started but the
-- migration step did not shows up as a warning. Read-only, on Drizzle's
-- bookkeeping table only: no org_id, no domain data, nothing RLS protects.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_namespace WHERE nspname = 'drizzle') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA drizzle TO ajour_app';
    EXECUTE 'GRANT SELECT ON drizzle."__drizzle_migrations" TO ajour_app';
  END IF;
END $$;
