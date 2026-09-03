import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { domainId, organizations, users } from "./foundation";
import { projects } from "./projects";

const tenant = () =>
  text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" });

/**
 * The conversation with the AI about a project, kept on the server. The
 * prototype let the browser send the history back with every message,
 * which meant the model's context was whatever the client said it was;
 * here the history is ours, per project, and the browser only adds to it.
 */
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: domainId("id"),
    orgId: tenant(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // user | assistant
    content: text("content").notNull(),
    /** What the assistant changed (structured lines), the snapshot to undo it, and the rows it created. */
    applied: jsonb("applied").$type<{
      lines: Array<{ type: string; payload: Record<string, unknown> }>;
      snapshotId: string;
      created: Record<string, string[] | undefined>;
      undoneAt?: string;
    } | null>(),
    engine: text("engine").notNull().default(""),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("chat_messages_project_idx").on(t.projectId, t.createdAt)],
);

/**
 * One row per model call, so calls per person and per workspace can be
 * counted and capped. Kept short: no content, only who, what kind, when.
 */
export const aiCalls = pgTable(
  "ai_calls",
  {
    id: domainId("id"),
    orgId: tenant(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    kind: text("kind").notNull(), // plan | status | replan | chat | tip
    engine: text("engine").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_calls_user_created_idx").on(t.userId, t.createdAt)],
);

export type ChatMessageRow = typeof chatMessages.$inferSelect;
