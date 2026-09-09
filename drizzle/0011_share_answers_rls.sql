-- Security for what a participant says through a share link: the grant,
-- forced RLS on org_id and an audit trigger. The write path sets the
-- workspace from the link it found, exactly as the read does; the service
-- narrows the surface further (only the holder's own tasks, only the
-- questions of an approved status). See docs/adr/0011.

GRANT SELECT, INSERT, UPDATE, DELETE ON "participant_replies" TO ajour_app;
--> statement-breakpoint

ALTER TABLE "participant_replies" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "participant_replies" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY app_tenant_participant_replies ON "participant_replies" FOR ALL TO ajour_app
  USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
--> statement-breakpoint

CREATE TRIGGER audit_participant_replies
  AFTER INSERT OR UPDATE OR DELETE ON "participant_replies"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
