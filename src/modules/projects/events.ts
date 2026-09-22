import { desc, eq } from "drizzle-orm";
import { events } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";

/**
 * The project's own history as structured facts. The type names what
 * happened and the payload carries the names and dates a sentence needs;
 * `messages/*.json` under `events` turns them into a line in the reader's
 * language, and the same lines are what the AI reads as recent activity.
 */
export type EventType =
  | "project.created"
  | "task.created"
  | "task.state"
  | "task.moved"
  | "task.relinked"
  | "task.renamed"
  | "task.people"
  | "task.subtasks"
  | "task.deleted"
  | "milestone.created"
  | "milestone.updated"
  | "milestone.done"
  | "milestone.reopened"
  | "milestone.deleted"
  | "decision.added"
  | "obstacle.added"
  | "obstacle.resolved"
  | "budget.set"
  | "expense.added"
  | "expense.toggled"
  | "expense.removed"
  | "roles.set"
  | "people.added"
  | "status.approved"
  | "status.sent"
  | "status.sendFailed"
  | "reminder.sent"
  | "replan.applied"
  | "snapshot.created"
  | "snapshot.restored"
  | "ai.applied"
  | "reply.state"
  | "reply.answer"
  | "reply.note";

/** participant: a person answering through a share link, named in the payload. */
export type ActorKind = "user" | "ai" | "system" | "participant";

export async function recordEvent(
  tx: AppTransaction,
  ctx: OrgContext,
  projectId: string,
  type: EventType,
  payload: Record<string, unknown> = {},
  actorKind: ActorKind = "user",
): Promise<void> {
  await tx.insert(events).values({
    orgId: ctx.orgId,
    projectId,
    type,
    payload,
    actorKind,
    actorUserId: ctx.userId,
  });
}

export async function recentEvents(tx: AppTransaction, projectId: string, limit = 15) {
  return tx
    .select()
    .from(events)
    .where(eq(events.projectId, projectId))
    .orderBy(desc(events.createdAt))
    .limit(limit);
}

/**
 * Renders an event with a translator. The catalogue holds one message per
 * type under `events`, nested on the dot in the type name — `task.created`
 * lives at `events.task.created` — because next-intl reads a dot as
 * nesting and refuses a flat key that contains one. Unknown payload keys
 * are passed through so a message can pick what it needs.
 */
export function renderEvent(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
  event: { type: string; payload: Record<string, unknown> },
): string {
  const values: Record<string, string | number | Date> = {};
  for (const [key, value] of Object.entries(event.payload)) {
    if (value === null || value === undefined) values[key] = "";
    else if (Array.isArray(value)) values[key] = value.map(String).join(", ");
    else if (typeof value === "number") values[key] = value;
    else values[key] = String(value);
  }
  try {
    return t(event.type, values);
  } catch {
    return event.type;
  }
}
