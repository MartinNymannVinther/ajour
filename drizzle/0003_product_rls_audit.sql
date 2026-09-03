-- Security for the product tables: grants, forced row-level security keyed
-- on org_id, audit triggers, the share-link read path and the one privileged
-- operation the application role is allowed: deleting a whole workspace.
-- See docs/adr/0005.

-- The application role owns the product tables in the only sense that
-- matters: it may read and write them, and RLS decides which rows.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "people", "projects", "milestones", "tasks", "task_participants", "obstacles", "decisions", "expenses", "status_updates", "snapshots", "tips", "events", "chat_messages", "ai_calls", "share_links"
TO ajour_app;
--> statement-breakpoint

-- Members of the active workspace are visible to the application role, so
-- the workspace can list who is in it. Credentials stay out of reach: the
-- role has no grant on accounts, sessions, passkeys or two_factors.
CREATE POLICY app_select_org_members ON "users" FOR SELECT TO ajour_app
  USING (id IN (SELECT user_id FROM "memberships" WHERE organization_id = app_current_org_id()));
--> statement-breakpoint

-- The share-link read path. A public status page has no session, so the
-- token itself is the context: the route sets app.share_hash, reads the one
-- link that matches, and only then sets the workspace it belongs to.
CREATE OR REPLACE FUNCTION app_current_share_hash() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.share_hash', true), '')
$$;
--> statement-breakpoint
ALTER TABLE "people" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "people" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "projects" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "milestones" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "milestones" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tasks" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "task_participants" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "task_participants" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "obstacles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "obstacles" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "decisions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "decisions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "expenses" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "status_updates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "status_updates" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "snapshots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "snapshots" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tips" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tips" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "chat_messages" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_calls" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_calls" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "share_links" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "share_links" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

-- One policy per table: rows of the active workspace, nothing else, for
-- reads and writes alike. Without a context every predicate is NULL.
CREATE POLICY app_tenant_people ON "people" FOR ALL TO ajour_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_tenant_projects ON "projects" FOR ALL TO ajour_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_tenant_milestones ON "milestones" FOR ALL TO ajour_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_tenant_tasks ON "tasks" FOR ALL TO ajour_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_tenant_task_participants ON "task_participants" FOR ALL TO ajour_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_tenant_obstacles ON "obstacles" FOR ALL TO ajour_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_tenant_decisions ON "decisions" FOR ALL TO ajour_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_tenant_expenses ON "expenses" FOR ALL TO ajour_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_tenant_status_updates ON "status_updates" FOR ALL TO ajour_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_tenant_snapshots ON "snapshots" FOR ALL TO ajour_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_tenant_tips ON "tips" FOR ALL TO ajour_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_tenant_events ON "events" FOR ALL TO ajour_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_tenant_chat_messages ON "chat_messages" FOR ALL TO ajour_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_tenant_ai_calls ON "ai_calls" FOR ALL TO ajour_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_select_share_links ON "share_links" FOR SELECT TO ajour_app
  USING (org_id = app_current_org_id() OR token_hash = app_current_share_hash());
--> statement-breakpoint
CREATE POLICY app_insert_share_links ON "share_links" FOR INSERT TO ajour_app
  WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_update_share_links ON "share_links" FOR UPDATE TO ajour_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint
CREATE POLICY app_delete_share_links ON "share_links" FOR DELETE TO ajour_app
  USING (org_id = app_current_org_id());
--> statement-breakpoint

-- Audit triggers on every table that holds what a workspace owns. events,
-- chat_messages, tips and ai_calls are excluded: two are logs themselves,
-- one is a daily cache and one is a counter, and auditing a log is a copy,
-- not a record (docs/adr/0003, 0005).
CREATE TRIGGER audit_people
  AFTER INSERT OR UPDATE OR DELETE ON "people"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint
CREATE TRIGGER audit_projects
  AFTER INSERT OR UPDATE OR DELETE ON "projects"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint
CREATE TRIGGER audit_milestones
  AFTER INSERT OR UPDATE OR DELETE ON "milestones"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint
CREATE TRIGGER audit_tasks
  AFTER INSERT OR UPDATE OR DELETE ON "tasks"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint
CREATE TRIGGER audit_task_participants
  AFTER INSERT OR UPDATE OR DELETE ON "task_participants"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint
CREATE TRIGGER audit_obstacles
  AFTER INSERT OR UPDATE OR DELETE ON "obstacles"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint
CREATE TRIGGER audit_decisions
  AFTER INSERT OR UPDATE OR DELETE ON "decisions"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint
CREATE TRIGGER audit_expenses
  AFTER INSERT OR UPDATE OR DELETE ON "expenses"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint
CREATE TRIGGER audit_status_updates
  AFTER INSERT OR UPDATE OR DELETE ON "status_updates"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint
CREATE TRIGGER audit_snapshots
  AFTER INSERT OR UPDATE OR DELETE ON "snapshots"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint
CREATE TRIGGER audit_share_links
  AFTER INSERT OR UPDATE OR DELETE ON "share_links"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
--> statement-breakpoint

-- Deleting a workspace: the one thing the application role may do that RLS
-- and grants would otherwise forbid, wrapped in a function that checks the
-- caller itself. Dogma 3 says everything a workspace owns can be deleted
-- again completely, and that includes the audit rows about it: they carry
-- the names and texts of the project, and a person who leaves must not
-- leave a shadow. The append-only guard is stepped around for exactly this
-- transaction, and one context-free row records that the deletion happened.
CREATE OR REPLACE FUNCTION delete_workspace(p_org_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user text := nullif(current_setting('app.user_id', true), '');
  v_role text;
BEGIN
  IF p_org_id IS NULL OR p_org_id <> nullif(current_setting('app.org_id', true), '') THEN
    RAISE EXCEPTION 'delete_workspace: not the active workspace';
  END IF;
  SELECT role INTO v_role FROM memberships WHERE organization_id = p_org_id AND user_id = v_user;
  IF v_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'delete_workspace: only the workspace owner may delete it';
  END IF;

  -- Domain rows, memberships and invitations follow the organization
  -- through cascading foreign keys; their audit rows are written by the
  -- triggers on the way out and purged just below.
  DELETE FROM organizations WHERE id = p_org_id;

  PERFORM set_config('session_replication_role', 'replica', true);
  DELETE FROM audit_log WHERE org_id = p_org_id;
  PERFORM set_config('session_replication_role', 'origin', true);

  INSERT INTO audit_log (org_id, actor_user_id, actor_type, action, entity_type, entity_id)
  VALUES (NULL, v_user, 'user', 'workspace.deleted', 'organizations', p_org_id);
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION delete_workspace(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION delete_workspace(text) TO ajour_app;
