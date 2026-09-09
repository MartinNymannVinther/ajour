import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/core/env";

/**
 * Outgoing mail, one door for the whole installation (docs/adr/0013).
 * Plain SMTP: the installation points `SMTP_URL` at a provider of its
 * own choosing — an EU one for the hosted instance, the association's
 * own for a self-hosted one — and nothing is sent anywhere else. Without
 * `SMTP_URL` nothing is sent, every feature that would send says so, and
 * the rest of the product works exactly as before: mail is an addition,
 * never a dependency.
 *
 * `MAIL_TRANSPORT=memory` keeps every message in a list instead of
 * sending it, which is what the tests and a developer without a mail
 * account use.
 */

export type MailAttachment = { filename: string; content: Buffer; contentType: string };

export type Mail = {
  to: string[];
  subject: string;
  text: string;
  attachments?: MailAttachment[];
};

export type SentMail = Mail & { from: string; sentAt: Date };

const outbox: SentMail[] = [];
let transporter: Transporter | null = null;

export function mailConfigured(): boolean {
  return env.MAIL_TRANSPORT === "memory" || Boolean(env.SMTP_URL);
}

function transport(): Transporter | null {
  if (env.MAIL_TRANSPORT === "memory") return null;
  if (!env.SMTP_URL) return null;
  transporter ??= nodemailer.createTransport(env.SMTP_URL);
  return transporter;
}

/**
 * Sends, or explains why not. Never throws on a provider error: the
 * caller decides whether a status that was approved but not mailed is a
 * failure (it is not — the approval stands, the mail is retried by hand).
 */
export async function sendMail(
  mail: Mail,
): Promise<{ sent: true } | { sent: false; reason: "notConfigured" | "noRecipients" | string }> {
  const to = [...new Set(mail.to.map((a) => a.trim()).filter(isEmail))];
  if (to.length === 0) return { sent: false, reason: "noRecipients" };
  if (!mailConfigured()) return { sent: false, reason: "notConfigured" };
  const from = env.MAIL_FROM;
  const message: SentMail = { ...mail, to, from, sentAt: new Date() };
  const t = transport();
  if (!t) {
    outbox.push(message);
    return { sent: true };
  }
  try {
    await t.sendMail({
      from,
      to: to.join(", "),
      subject: mail.subject,
      text: mail.text,
      attachments: mail.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    return { sent: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("mail failed", reason);
    return { sent: false, reason };
  }
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

/** Only for tests and the memory transport: what would have gone out. */
export function outboxMails(): SentMail[] {
  return [...outbox];
}

export function clearOutbox() {
  outbox.length = 0;
}
