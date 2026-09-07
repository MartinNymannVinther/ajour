ALTER TABLE "expenses" ADD COLUMN "spent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- A line that was marked incurred had all of its money spent.
UPDATE "expenses" SET "spent" = "amount" WHERE "incurred";
