-- Better Auth 1.7.5 dropped the issuer field from the account model again
-- (1.7.1 introduced it; the adapter no longer writes it, so a NOT NULL
-- column refuses every sign-up). Account identity is provider + account id,
-- which is what it was before 1.7, and the unique index says so.
DROP INDEX "accounts_issuer_account_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_uq" ON "accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "issuer";