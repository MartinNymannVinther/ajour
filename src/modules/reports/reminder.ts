import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { todayInCopenhagen, weekKey, weekNumberFromKey } from "@/core/dates";
import { authDb } from "@/core/db/client";
import { demoWorkspaces, events, memberships, organizations, users } from "@/core/db/schema";
import { withOrgContext } from "@/core/db/tenant";
import { env } from "@/core/env";
import { mailConfigured, sendMail } from "@/core/mail";
import da from "../../../messages/da.json";
import en from "../../../messages/en.json";
import { listProjects } from "@/modules/projects/read";

/**
 * The weekly nudge (docs/adr/0013): one mail per member per workspace
 * naming the projects that have no approved status this week yet, with a
 * link to write one. Runs when the scheduler calls it — a Thursday
 * morning is the intended time — and never twice for the same project in
 * the same week, because the send is recorded as an event. Demo
 * workspaces and projects too new to judge are left alone.
 */

type Locale = "da" | "en";

export type ReminderOutcome = {
  workspaces: number;
  projects: number;
  mails: number;
  skipped: "notConfigured" | null;
};

type Words = (key: string, values?: Record<string, string | number>) => string;

function words(locale: Locale): Words {
  const messages = (locale === "da" ? da : en) as unknown as Record<string, unknown>;
  const t = createTranslator({ locale, messages, namespace: "status.reminder" });
  return (key, values) => t(key as never, values as never);
}

export async function sendStatusReminders(
  today = todayInCopenhagen(),
  locale: Locale = "da",
): Promise<ReminderOutcome> {
  const outcome: ReminderOutcome = { workspaces: 0, projects: 0, mails: 0, skipped: null };
  if (!mailConfigured()) return { ...outcome, skipped: "notConfigured" };
  const week = weekKey(today);
  const t = words(locale);

  const demoIds = (
    await authDb.select({ id: demoWorkspaces.organizationId }).from(demoWorkspaces)
  ).map((r) => r.id);
  const orgs = await authDb
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(demoIds.length ? sql`${organizations.id} not in ${demoIds}` : sql`true`);

  for (const org of orgs) {
    const members = await authDb
      .select({ userId: memberships.userId, email: users.email, name: users.name })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.organizationId, org.id));
    if (members.length === 0) continue;
    const ctx = { orgId: org.id, userId: members[0]!.userId };

    const projects = (await listProjects(ctx, today)).filter(
      (p) =>
        !p.archivedAt &&
        p.health.level !== "new" &&
        (!p.latestStatusAt || weekKey(p.latestStatusAt.toISOString().slice(0, 10)) !== week),
    );
    if (projects.length === 0) continue;

    // Not twice in one week: the previous send is an event on the project.
    const alreadySent = await withOrgContext(ctx, (tx) =>
      tx
        .select({ projectId: events.projectId })
        .from(events)
        .where(
          and(
            inArray(
              events.projectId,
              projects.map((p) => p.id),
            ),
            eq(events.type, "reminder.sent"),
            sql`${events.payload}->>'week' = ${week}`,
          ),
        ),
    );
    const done = new Set(alreadySent.map((r) => r.projectId));
    const due = projects.filter((p) => !done.has(p.id));
    if (due.length === 0) continue;

    outcome.workspaces += 1;
    outcome.projects += due.length;
    const weekLabel = t("week", { number: weekNumberFromKey(week) });
    const lines = due.map((p) => {
      const url = new URL(
        locale === "da" ? `/projects/${p.id}/status` : `/en/projects/${p.id}/status`,
        env.BETTER_AUTH_URL,
      ).toString();
      return `• ${p.name}\n  ${url}`;
    });
    const text = [
      t("intro", { workspace: org.name, week: weekLabel, count: due.length }),
      "",
      ...lines,
      "",
      t("outro"),
    ].join("\n");
    for (const member of members) {
      const result = await sendMail({
        to: [member.email],
        subject: t("subject", { workspace: org.name, week: weekLabel }),
        text,
      });
      if (result.sent) outcome.mails += 1;
    }
    await withOrgContext(ctx, (tx) =>
      tx.insert(events).values(
        due.map((p) => ({
          orgId: org.id,
          projectId: p.id,
          type: "reminder.sent",
          payload: { week, count: members.length },
          actorKind: "system",
          actorUserId: null,
        })),
      ),
    );
  }
  return outcome;
}

/**
 * For the endpoint: a bearer token that matches CRON_SECRET, and nothing
 * else. Both sides are hashed first so the comparison is over two equal
 * lengths whatever was sent, and then compared in constant time — the
 * timing is not a practical attack over HTTP, but a comparison that
 * leaks and one that does not cost the same to write.
 */
export function schedulerAllowed(authorization: string | null): boolean {
  if (!env.CRON_SECRET) return false;
  const token = authorization?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (token.length === 0) return false;
  const given = createHash("sha256").update(token).digest();
  const expected = createHash("sha256").update(env.CRON_SECRET).digest();
  return timingSafeEqual(given, expected);
}
