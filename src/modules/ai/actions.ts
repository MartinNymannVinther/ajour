"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireOrgContext } from "@/core/auth/guard";
import { weekNumberFromKey } from "@/core/dates";
import { withOrgContext } from "@/core/db/tenant";
import { recentEvents, renderEvent } from "@/modules/projects/events";
import { restoreSnapshotById } from "@/modules/projects/snapshots";
import { fail, ok, type Result } from "@/modules/projects/types";
import { sendChat, type ChatOutcome } from "./chat";
import { MAX_CHAT_CHARS, RateLimited, capText } from "./limits";
import { dismissTip, getDailyTip, type DailyTip } from "./tips";
import type { Locale } from "./types";

/**
 * The AI's own actions. Everything here counts a call before the model is
 * asked, so a refused call never reaches it, and everything the AI changed
 * can be undone from the message that changed it.
 */

const projectId = z.string().min(1).max(64);

/** The activity the status and tip flows read, as sentences in the caller's language. */
async function recentActivity(orgId: string, userId: string, id: string): Promise<string[]> {
  const events = await getTranslations("events");
  const rows = await withOrgContext({ orgId, userId }, (tx) => recentEvents(tx, id, 25));
  return rows.map((row) => renderEvent(events, row));
}

export async function sendChatAction(raw: unknown): Promise<Result<ChatOutcome>> {
  const ctx = await requireOrgContext();
  if (!ctx) return fail("unauthorized");
  const parsed = z
    .object({ projectId, message: z.string().min(1).max(MAX_CHAT_CHARS) })
    .safeParse(raw);
  if (!parsed.success) return fail("invalid");
  const locale = (await getLocale()) as Locale;
  const chat = await getTranslations("chat");
  try {
    const outcome = await sendChat(
      ctx,
      parsed.data.projectId,
      capText(parsed.data.message, MAX_CHAT_CHARS),
      locale,
      chat("snapshotLabel"),
    );
    if (!outcome) return fail("notFound");
    revalidatePath(`/projects/${parsed.data.projectId}`);
    return ok(outcome);
  } catch (error) {
    if (error instanceof RateLimited) return fail("conflict");
    console.error("chat failed", error);
    return fail("generic");
  }
}

/** Undo: restores the snapshot the AI took, and removes only what it created. */
export async function undoChatChangeAction(raw: unknown): Promise<Result<undefined>> {
  const ctx = await requireOrgContext();
  if (!ctx) return fail("unauthorized");
  const parsed = z
    .object({
      projectId,
      snapshotId: z.string().min(1).max(64),
      created: z.record(z.string(), z.array(z.string()).max(200)).default({}),
    })
    .safeParse(raw);
  if (!parsed.success) return fail("invalid");
  const chat = await getTranslations("chat");
  try {
    const done = await withOrgContext(ctx, (tx) =>
      restoreSnapshotById(tx, ctx, parsed.data.snapshotId, parsed.data.created, () =>
        chat("beforeUndo"),
      ),
    );
    if (!done) return fail("notFound");
    revalidatePath(`/projects/${parsed.data.projectId}`);
    return ok(undefined);
  } catch (error) {
    console.error("undo failed", error);
    return fail("generic");
  }
}

export async function dailyTipAction(raw: unknown): Promise<Result<DailyTip | null>> {
  const ctx = await requireOrgContext();
  if (!ctx) return fail("unauthorized");
  const parsed = z.object({ projectId, force: z.boolean().default(false) }).safeParse(raw);
  if (!parsed.success) return fail("invalid");
  const locale = (await getLocale()) as Locale;
  const common = await getTranslations("common");
  try {
    const activity = await recentActivity(ctx.orgId, ctx.userId, parsed.data.projectId);
    const tip = await getDailyTip(
      ctx,
      parsed.data.projectId,
      locale,
      activity,
      (key) => common("week", { number: weekNumberFromKey(key) }),
      parsed.data.force,
    );
    return ok(tip);
  } catch (error) {
    if (error instanceof RateLimited) return fail("conflict");
    console.error("daily tip failed", error);
    return fail("generic");
  }
}

export async function dismissTipAction(raw: unknown): Promise<Result<undefined>> {
  const ctx = await requireOrgContext();
  if (!ctx) return fail("unauthorized");
  const parsed = z.object({ tipId: z.string().min(1).max(64), projectId }).safeParse(raw);
  if (!parsed.success) return fail("invalid");
  await dismissTip(ctx, parsed.data.tipId);
  revalidatePath(`/projects/${parsed.data.projectId}`);
  return ok(undefined);
}
