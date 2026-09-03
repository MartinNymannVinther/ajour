CREATE TABLE "demo_workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "demo_workspaces_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
ALTER TABLE "demo_workspaces" ADD CONSTRAINT "demo_workspaces_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "demo_workspaces_expires_at_idx" ON "demo_workspaces" USING btree ("expires_at");