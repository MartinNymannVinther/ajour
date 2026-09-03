import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { domainId, organizations, users } from "./foundation";
import { projects } from "./projects";

/**
 * A share link: a token that lets anyone read one project's status page
 * without a login. Only the hash is stored, links can expire and be
 * revoked, and the page behind them is served by a dedicated minimal
 * query that never includes the budget, drafts or obstacles.
 */
export const shareLinks = pgTable(
  "share_links",
  {
    id: domainId("id"),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** sha256 hex of the token in the link. */
    tokenHash: text("token_hash").notNull(),
    label: text("label").notNull().default(""),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("share_links_token_hash_uq").on(t.tokenHash),
    index("share_links_project_idx").on(t.projectId),
  ],
);

export type ShareLink = typeof shareLinks.$inferSelect;
