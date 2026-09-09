import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { domainId, organizations, users } from "./foundation";
import { people, projects, statusUpdates, tasks } from "./projects";

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
    /**
     * A link that may answer: the holder picks a name from the project's
     * people and can then mark their own tasks, leave a note on them and
     * answer the questions in the latest status. Off by default; a link
     * made for a steering group stays a read (docs/adr/0011).
     */
    canAnswer: boolean("can_answer").notNull().default(false),
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

export const REPLY_KINDS = ["answer", "note"] as const;
export type ReplyKind = (typeof REPLY_KINDS)[number];

/**
 * What a participant said through a share link: an answer to one of the
 * questions in an approved status, or a note on one of their own tasks.
 * The question is copied in so the reply reads on its own after the
 * status it answered has been superseded. Replies are facts the next
 * status is written from; they are never edited, only added.
 */
export const participantReplies = pgTable(
  "participant_replies",
  {
    id: domainId("id"),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    shareLinkId: text("share_link_id").references(() => shareLinks.id, { onDelete: "set null" }),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    statusUpdateId: text("status_update_id").references(() => statusUpdates.id, {
      onDelete: "set null",
    }),
    questionIndex: integer("question_index"),
    question: text("question").notNull().default(""),
    taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("participant_replies_project_idx").on(t.projectId, t.createdAt)],
);

export type ParticipantReply = typeof participantReplies.$inferSelect;
