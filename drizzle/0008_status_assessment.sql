ALTER TABLE "status_updates" ADD COLUMN "rag" text;--> statement-breakpoint
ALTER TABLE "status_updates" ADD COLUMN "manager_comment" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "status_updates" ADD COLUMN "management_asks" jsonb DEFAULT '[]'::jsonb NOT NULL;