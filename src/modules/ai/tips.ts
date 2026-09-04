import { and, desc, eq } from "drizzle-orm";
import { tips } from "@/core/db/schema";
import { diffDays, todayInCopenhagen } from "@/core/dates";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { readProjectFull } from "@/modules/projects/read";
import { buildChatContext } from "./context";
import { withEngine } from "./index";
import { reserveAiCall } from "./limits";
import { observeProject } from "./tip-rules";
import type { Locale, Tip } from "./types";

/**
 * The daily tip: the AI looks at the whole project and its history and
 * points at one thing to do today. One per project per day, stored, so a
 * page view never costs a model call; "look again" asks afresh.
 */
export type DailyTip = Tip & {
  id: string;
  day: string;
  engine: string;
  fallback: boolean;
  dismissed: boolean;
};

export async function getDailyTip(
  ctx: OrgContext,
  projectId: string,
  locale: Locale,
  recentActivity: string[],
  weekLabel: (weekKey: string) => string,
  force = false,
): Promise<DailyTip | null> {
  const today = todayInCopenhagen();
  const existing = await withOrgContext(ctx, async (tx) => {
    const [row] = await tx
      .select()
      .from(tips)
      .where(and(eq(tips.projectId, projectId), eq(tips.day, today)))
      .limit(1);
    return row ?? null;
  });
  if (existing && !force) return rowToTip(existing, false);

  const prepared = await withOrgContext(ctx, async (tx) => {
    const full = await readProjectFull(tx, projectId);
    if (!full) return null;
    await reserveAiCall(tx, ctx, "tip", "");
    const previous = await tx
      .select({ title: tips.title })
      .from(tips)
      .where(eq(tips.projectId, projectId))
      .orderBy(desc(tips.createdAt))
      .limit(5);
    return { full, previous: previous.map((p) => p.title) };
  });
  if (!prepared) return null;

  const context = buildChatContext(prepared.full, locale, today);
  const approved = prepared.full.statusUpdates.filter((s) => s.approvedAt);
  const daysSinceLastStatus = approved[0]?.approvedAt
    ? diffDays(approved[0].approvedAt.toISOString().slice(0, 10), today)
    : null;
  const input = {
    context,
    recentActivity,
    statusHistory: approved.slice(0, 3).map((s) => ({
      weekLabel: weekLabel(s.weekKey),
      date: (s.approvedAt ?? s.createdAt).toISOString().slice(0, 10),
      text: s.text,
    })),
    daysSinceLastStatus,
    previousTips: prepared.previous,
    observations: observeProject(context, daysSinceLastStatus).map((o) => o.text),
  };
  const res = await withEngine(ctx, (engine) => engine.dailyTip(input));

  return withOrgContext(ctx, async (tx) => {
    if (existing) await tx.delete(tips).where(eq(tips.id, existing.id));
    const [row] = await tx
      .insert(tips)
      .values({
        orgId: ctx.orgId,
        projectId,
        day: today,
        title: res.result.title,
        text: res.result.text,
        action: res.result.action ?? "",
        engine: res.engine,
      })
      .returning();
    return rowToTip(row!, res.fallback);
  });
}

export async function dismissTip(ctx: OrgContext, tipId: string): Promise<void> {
  await withOrgContext(ctx, (tx) =>
    tx.update(tips).set({ dismissedAt: new Date() }).where(eq(tips.id, tipId)),
  );
}

function rowToTip(row: typeof tips.$inferSelect, fallback: boolean): DailyTip {
  return {
    id: row.id,
    day: row.day,
    title: row.title,
    text: row.text,
    action: row.action || null,
    engine: row.engine,
    fallback,
    dismissed: Boolean(row.dismissedAt),
  };
}
