-- The demo table is installation state, not workspace data. The
-- application role never touches it: the demo route runs as the auth role
-- (which already creates users and organizations) and the cleanup runs as
-- the migration role. Being explicit about that is cheaper than
-- discovering it later.
REVOKE ALL ON TABLE demo_workspaces FROM ajour_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE demo_workspaces TO ajour_auth;
--> statement-breakpoint
-- The meta-test in tests/rls requires forced RLS on every table it can
-- see. This one is deliberately unreachable for the application role
-- instead, so it gets RLS with no policy at all: even if a grant were
-- added by mistake, the role would still see nothing.
ALTER TABLE demo_workspaces ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE demo_workspaces FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Forced RLS applies to the granted role as well, so the one role that is
-- meant to reach this table needs a policy saying so. The application role
-- has no grant and no policy: two locks, either of which alone would do.
CREATE POLICY demo_auth_all ON demo_workspaces FOR ALL TO ajour_auth USING (true) WITH CHECK (true);
