import { asc, desc, eq } from "drizzle-orm";
import { chatMessages } from "@/core/db/schema";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { recordEvent } from "@/modules/projects/events";
import { readProjectFull } from "@/modules/projects/read";
import { takeSnapshot, type CreatedRows } from "@/modules/projects/snapshots";
import { applyChatReply, type AppliedLine } from "./apply";
import { buildChatContext } from "./context";
import { withEngine } from "./index";
import { capText, MAX_CHAT_CHARS, reserveAiCall } from "./limits";
import type { ChatMessage, Locale } from "./types";
import { chatReplyHasChanges } from "./types";

/**
 * The chat about a project. The history lives on the server, per project;
 * the browser sends one message. If the reply asks for changes, a
 * snapshot is taken, the changes are applied through the ordinary
 * services, and the message remembers what was done and how to undo it.
 */
export type ChatOutcome = {
  reply: string;
  engine: string;
  fallback: boolean;
  fallbackReason?: string;
  applied: { lines: AppliedLine[]; snapshotId: string; created: CreatedRows } | null;
  messageId: string;
};

export async function listChat(ctx: OrgContext, projectId: string, limit = 40) {
  return withOrgContext(ctx, (tx) =>
    tx
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.projectId, projectId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit)
      .then((rows) => rows.reverse()),
  );
}

export async function sendChat(
  ctx: OrgContext,
  projectId: string,
  rawMessage: string,
  locale: Locale,
  snapshotLabel: string,
): Promise<ChatOutcome | null> {
  const message = capText(rawMessage, MAX_CHAT_CHARS);
  if (!message) return null;

  // Read the project and the history, and count the call, before the model
  // is asked; a refused call never reaches it.
  const prepared = await withOrgContext(ctx, async (tx) => {
    const full = await readProjectFull(tx, projectId);
    if (!full) return null;
    await reserveAiCall(tx, ctx, "chat", "");
    const history = await tx
      .select({ role: chatMessages.role, content: chatMessages.content })
      .from(chatMessages)
      .where(eq(chatMessages.projectId, projectId))
      .orderBy(asc(chatMessages.createdAt));
    await tx
      .insert(chatMessages)
      .values({ orgId: ctx.orgId, projectId, role: "user", content: message, userId: ctx.userId });
    return { full, history: history.slice(-8) as ChatMessage[] };
  });
  if (!prepared) return null;

  const context = buildChatContext(prepared.full, locale);
  const res = await withEngine(ctx, (engine) => engine.chat(context, prepared.history, message));
  const reply = res.result;

  return withOrgContext(ctx, async (tx) => {
    let applied: ChatOutcome["applied"] = null;
    if (chatReplyHasChanges(reply)) {
      const snapshotId = await takeSnapshot(tx, ctx, projectId, snapshotLabel, "ai");
      const done = await applyChatReply(tx, ctx, projectId, reply);
      if (snapshotId) applied = { lines: done.lines, snapshotId, created: done.created };
      await recordEvent(tx, ctx, projectId, "ai.applied", { count: done.lines.length }, "ai");
    }
    const [row] = await tx
      .insert(chatMessages)
      .values({
        orgId: ctx.orgId,
        projectId,
        role: "assistant",
        content: reply.reply,
        engine: res.engine,
        applied: applied
          ? { lines: applied.lines, snapshotId: applied.snapshotId, created: applied.created }
          : null,
        userId: ctx.userId,
      })
      .returning({ id: chatMessages.id });
    return {
      reply: reply.reply,
      engine: res.engine,
      fallback: res.fallback,
      fallbackReason: res.fallbackReason,
      applied,
      messageId: row!.id,
    };
  });
}
