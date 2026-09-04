import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { milestones, projects, shareLinks, statusUpdates, tasks } from "@/core/db/schema";
import { appDb } from "@/core/db/client";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { env } from "@/core/env";
import { parseStatusReport, type StatusReport } from "@/modules/reports/status-report";
export { SHARE_TTL_OPTIONS } from "./constants";

/**
 * Share links: a token in a URL that opens one project's status page for
 * anyone who has it, no login. Stored as a hash, revocable, optionally
 * expiring. What the page shows is decided by one minimal query here and
 * never by the ordinary project read: no budget, no obstacles, no drafts,
 * no chat.
 */

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function shareUrl(token: string, locale: "da" | "en"): string {
  const url = new URL(locale === "da" ? `/s/${token}` : `/en/s/${token}`, env.BETTER_AUTH_URL);
  return url.toString();
}

export async function createShareLink(
  ctx: OrgContext,
  projectId: string,
  label: string,
  ttlDays: number | null,
): Promise<{ id: string; token: string; expiresAt: Date | null } | null> {
  const token = randomBytes(18).toString("base64url");
  const expiresAt = ttlDays ? new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000) : null;
  return withOrgContext(ctx, async (tx) => {
    const [project] = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (!project) return null;
    const [row] = await tx
      .insert(shareLinks)
      .values({
        orgId: ctx.orgId,
        projectId,
        tokenHash: hashToken(token),
        label: label.trim().slice(0, 80),
        createdBy: ctx.userId,
        expiresAt,
      })
      .returning({ id: shareLinks.id });
    return { id: row!.id, token, expiresAt };
  });
}

export async function revokeShareLink(ctx: OrgContext, linkId: string): Promise<boolean> {
  return withOrgContext(ctx, async (tx) => {
    const rows = await tx
      .update(shareLinks)
      .set({ revokedAt: new Date() })
      .where(and(eq(shareLinks.id, linkId), isNull(shareLinks.revokedAt)))
      .returning({ id: shareLinks.id });
    return rows.length > 0;
  });
}

/**
 * What a shared report may say. The frozen report holds the money and the
 * obstacles too, because the workspace's own PDF needs them; the public
 * page must not, so they are cut here rather than at the template.
 */
function publicReport(raw: unknown): StatusReport | null {
  const report = parseStatusReport(raw);
  if (!report) return null;
  // Money, obstacles, what management is asked for and the money lines
  // are for the workspace; a participant with a link gets the plan and
  // the words.
  return { ...report, economy: null, expenses: [], obstacles: [], managementAsks: [] };
}

export type SharedProject = {
  name: string;
  goal: string;
  today: string;
  milestones: Array<{ id: string; title: string; date: string; done: boolean }>;
  tasks: Array<{
    id: string;
    title: string;
    state: string;
    startDate: string;
    endDate: string;
    milestoneId: string | null;
  }>;
  statuses: Array<{
    id: string;
    weekKey: string;
    text: string;
    approvedAt: Date;
    report: StatusReport | null;
  }>;
};

/**
 * The public read. Runs on the application role without a session: the
 * token hash is the only context until the link row is found, then the
 * workspace it belongs to is set for the rest of the transaction.
 */
export async function readSharedProject(
  token: string,
  today: string,
): Promise<SharedProject | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const hash = hashToken(token);
  return appDb.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.share_hash', ${hash}, true)`);
    const [link] = await tx
      .select()
      .from(shareLinks)
      .where(and(eq(shareLinks.tokenHash, hash), isNull(shareLinks.revokedAt)))
      .limit(1);
    if (!link) return null;
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) return null;
    await tx.execute(sql`select set_config('app.org_id', ${link.orgId}, true)`);
    const [project] = await tx
      .select({ name: projects.name, goal: projects.goal })
      .from(projects)
      .where(eq(projects.id, link.projectId))
      .limit(1);
    if (!project) return null;
    const ms = await tx
      .select({
        id: milestones.id,
        title: milestones.title,
        date: milestones.date,
        doneAt: milestones.doneAt,
      })
      .from(milestones)
      .where(eq(milestones.projectId, link.projectId))
      .orderBy(asc(milestones.date));
    const ts = await tx
      .select({
        id: tasks.id,
        title: tasks.title,
        state: tasks.state,
        startDate: tasks.startDate,
        endDate: tasks.endDate,
        milestoneId: tasks.milestoneId,
      })
      .from(tasks)
      .where(eq(tasks.projectId, link.projectId))
      .orderBy(asc(tasks.startDate));
    const st = await tx
      .select({
        id: statusUpdates.id,
        weekKey: statusUpdates.weekKey,
        text: statusUpdates.text,
        approvedAt: statusUpdates.approvedAt,
        details: statusUpdates.details,
      })
      .from(statusUpdates)
      .where(eq(statusUpdates.projectId, link.projectId))
      .orderBy(desc(statusUpdates.approvedAt));
    await tx.update(shareLinks).set({ lastUsedAt: new Date() }).where(eq(shareLinks.id, link.id));
    return {
      name: project.name,
      goal: project.goal,
      today,
      milestones: ms.map((m) => ({
        id: m.id,
        title: m.title,
        date: m.date,
        done: Boolean(m.doneAt),
      })),
      tasks: ts,
      statuses: st
        .filter((s) => s.approvedAt)
        .map((s) => ({
          id: s.id,
          weekKey: s.weekKey,
          text: s.text,
          approvedAt: s.approvedAt!,
          report: publicReport(s.details),
        })),
    };
  });
}
