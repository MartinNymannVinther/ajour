import { and, eq } from "drizzle-orm";
import { env } from "@/core/env";
import { isEmail, mailConfigured, sendMail } from "@/core/mail";
import { projects, statusUpdates, type StatusRecipient } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent } from "@/modules/projects/events";
import { pdfFileName } from "./pdf-words";
import type { ReportWords } from "./words";
import { parseStatusReport } from "./status-report";
import { renderStatusPdf } from "./status-pdf";

/**
 * The approved status out of the house (docs/adr/0013). A person pressed
 * approve and chose to send, so the mail goes: the summary and the
 * manager's comment in the body, the PDF attached, and the project's
 * page linked for the people who have a login. Recipients live on the
 * project so next week is prefilled; a status never sends on its own.
 */

export const MAX_RECIPIENTS = 20;

export function cleanRecipients(raw: unknown): StatusRecipient[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: StatusRecipient[] = [];
  for (const item of raw) {
    const r = (item ?? {}) as Record<string, unknown>;
    const email = typeof r.email === "string" ? r.email.trim().toLowerCase() : "";
    if (!isEmail(email) || seen.has(email)) continue;
    seen.add(email);
    out.push({ email, name: typeof r.name === "string" ? r.name.trim().slice(0, 80) : "" });
    if (out.length >= MAX_RECIPIENTS) break;
  }
  return out;
}

export async function setStatusRecipients(
  tx: AppTransaction,
  projectId: string,
  recipients: StatusRecipient[],
): Promise<void> {
  await tx.update(projects).set({ statusRecipients: recipients }).where(eq(projects.id, projectId));
}

export type MailWords = {
  subject: (project: string, week: string) => string;
  intro: (project: string, week: string, by: string) => string;
  comment: string;
  openLink: string;
  sentBy: string;
};

export type SendOutcome =
  | { sent: true; count: number }
  | { sent: false; reason: "notConfigured" | "noRecipients" | "notFound" | string };

/**
 * Renders the frozen report to PDF and mails it. Reads the status inside
 * the workspace's own transaction, so a status id from elsewhere is not
 * found. Records an event either way, so the history says whether the
 * status went out.
 */
export async function mailApprovedStatus(
  tx: AppTransaction,
  ctx: OrgContext,
  projectId: string,
  statusId: string,
  words: { mail: MailWords; report: ReportWords },
  locale: "da" | "en",
): Promise<SendOutcome> {
  const [project] = await tx
    .select({ recipients: projects.statusRecipients })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  const [row] = await tx
    .select()
    .from(statusUpdates)
    .where(and(eq(statusUpdates.id, statusId), eq(statusUpdates.projectId, projectId)))
    .limit(1);
  const report = row ? parseStatusReport(row.details) : null;
  if (!project || !row || !report) return { sent: false, reason: "notFound" };
  const recipients = cleanRecipients(project.recipients);
  if (recipients.length === 0) return { sent: false, reason: "noRecipients" };
  if (!mailConfigured()) return { sent: false, reason: "notConfigured" };

  const pdf = await renderStatusPdf(report, words.report);
  const week = words.report.week(report.weekKey);
  const link = new URL(
    locale === "da" ? `/projects/${projectId}` : `/en/projects/${projectId}`,
    env.BETTER_AUTH_URL,
  ).toString();
  const body = [
    words.mail.intro(report.projectName, week, report.approvedByName),
    "",
    row.text,
    row.managerComment ? `\n${words.mail.comment}\n${row.managerComment}` : "",
    "",
    `${words.mail.openLink}: ${link}`,
    "",
    words.mail.sentBy,
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  const result = await sendMail({
    to: recipients.map((r) => r.email),
    subject: words.mail.subject(report.projectName, week),
    text: body,
    attachments: [
      {
        filename: pdfFileName(report.projectName, report.weekKey),
        content: pdf,
        contentType: "application/pdf",
      },
    ],
  });
  await recordEvent(tx, ctx, projectId, result.sent ? "status.sent" : "status.sendFailed", {
    week: report.weekKey,
    count: recipients.length,
    reason: result.sent ? "" : result.reason,
  });
  return result.sent ? { sent: true, count: recipients.length } : result;
}
