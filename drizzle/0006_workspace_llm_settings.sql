CREATE TABLE "workspace_llm_settings" (
	"id" text PRIMARY KEY DEFAULT (gen_random_uuid())::text NOT NULL,
	"org_id" text NOT NULL,
	"provider" text NOT NULL,
	"model" text,
	"api_key_cipher" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_llm_settings_org_id_unique" UNIQUE("org_id")
);
--> statement-breakpoint
ALTER TABLE "workspace_llm_settings" ADD CONSTRAINT "workspace_llm_settings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_llm_settings" ADD CONSTRAINT "workspace_llm_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;