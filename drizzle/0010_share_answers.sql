CREATE TABLE "participant_replies" (
	"id" text PRIMARY KEY DEFAULT (gen_random_uuid())::text NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"share_link_id" text,
	"person_id" text NOT NULL,
	"kind" text NOT NULL,
	"status_update_id" text,
	"question_index" integer,
	"question" text DEFAULT '' NOT NULL,
	"task_id" text,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "share_links" ADD COLUMN "can_answer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "participant_replies" ADD CONSTRAINT "participant_replies_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_replies" ADD CONSTRAINT "participant_replies_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_replies" ADD CONSTRAINT "participant_replies_share_link_id_share_links_id_fk" FOREIGN KEY ("share_link_id") REFERENCES "public"."share_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_replies" ADD CONSTRAINT "participant_replies_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_replies" ADD CONSTRAINT "participant_replies_status_update_id_status_updates_id_fk" FOREIGN KEY ("status_update_id") REFERENCES "public"."status_updates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_replies" ADD CONSTRAINT "participant_replies_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "participant_replies_project_idx" ON "participant_replies" USING btree ("project_id","created_at");