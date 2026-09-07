import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { formatDateDa } from "@/core/dates";
import { getSession } from "@/core/auth/session";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { formatMoney } from "@/modules/ai/phrases";
import type { Locale } from "@/modules/ai/types";
import { readProjectFull } from "@/modules/projects/read";
import { prepareStatus, type StatusWords } from "./prepare";
import {
  buildStatusReport,
  RAG_VALUES,
  type ManagementAsk,
  type StatusAuthored,
  type StatusReport,
} from "./status-report";

/**
 * What the status actions and the draft-PDF route share: the shape of
 * what a person authors, the words the assessment speaks in, and the
 * report built from a draft exactly the way approval would build it.
 * Not a server-action file on purpose: `buildDraftReport` takes a tenant
 * context, and a function that takes one must never be callable from a
 * browser.
 */

const projectId = z.string().min(1).max(64);
export const Ask = z.object({
  id: z.string().min(1).max(64),
  text: z.string().trim().min(1).max(400),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  carriedFrom: z.string().max(12).nullable(),
  answered: z.boolean(),
});
export const Authored = z.object({
  projectId,
  text: z.string().trim().min(1).max(4000),
  rag: z.enum(RAG_VALUES as [string, ...string[]]),
  ragSuggested: z.enum(RAG_VALUES as [string, ...string[]]),
  ragReason: z.string().trim().max(600),
  managerComment: z.string().trim().max(3000),
  managementAsks: z.array(Ask).max(8),
  nextWeek: z.array(z.string().trim().min(1).max(200)).max(6),
  questions: z.array(z.string().trim().max(300)).max(5).default([]),
  engine: z.string().max(80).default(""),
});
export type AuthoredInput = z.infer<typeof Authored>;

export async function statusWords(locale: Locale): Promise<StatusWords> {
  const t = await getTranslations("status.reasons");
  const s = await getTranslations("status.sinceLast");
  return {
    reason: (r) => {
      switch (r.key) {
        case "early":
          return t("early");
        case "onTrack":
          return t("onTrack");
        case "milestoneAtRisk":
          return t("milestoneAtRisk", {
            title: r.title,
            date: formatDateDa(r.date),
            days: r.days,
            open: r.open,
          });
        case "milestoneMissed":
          return t("milestoneMissed", { title: r.title, date: formatDateDa(r.date), days: r.days });
        case "overdue":
          return t("overdue", { count: r.count, example: r.example });
        case "obstacles":
          return t("obstacles", { count: r.count });
        case "overBudget":
          return t("overBudget", { percent: r.percent });
        case "spendAhead":
          return t("spendAhead", { spend: r.spendPercent, work: r.workPercent });
      }
    },
    sinceLast: {
      tasksDone: (count, example) => s("tasksDone", { count, example }),
      tasksMoved: (count, example) => s("tasksMoved", { count, example }),
      milestonesReached: (titles) => s("milestonesReached", { titles }),
      milestonesChanged: (titles) => s("milestonesChanged", { titles }),
      obstaclesAdded: (count, example) => s("obstaclesAdded", { count, example }),
      obstaclesResolved: (count, example) => s("obstaclesResolved", { count, example }),
      decisions: (count, example) => s("decisions", { count, example }),
      budgetSet: (amount) => s("budgetSet", { amount: formatMoney(amount, locale) }),
      nothing: s("nothing"),
    },
  };
}

export async function approverName(): Promise<string> {
  const session = await getSession();
  return session?.user.name ?? "";
}

export function authoredFrom(input: AuthoredInput): StatusAuthored {
  return {
    text: input.text,
    rag: input.rag as StatusAuthored["rag"],
    ragSuggested: input.ragSuggested as StatusAuthored["rag"],
    ragReason: input.ragReason,
    managerComment: input.managerComment,
    managementAsks: input.managementAsks as ManagementAsk[],
    nextWeek: input.nextWeek,
    engine: input.engine,
  };
}

/** Builds the report the way approval would, for a PDF of the draft. */
export async function buildDraftReport(
  ctx: OrgContext,
  input: AuthoredInput,
): Promise<StatusReport | null> {
  const locale = (await getLocale()) as Locale;
  const words = await statusWords(locale);
  const approvedByName = await approverName();
  return withOrgContext(ctx, async (tx) => {
    const full = await readProjectFull(tx, input.projectId);
    if (!full) return null;
    const status = await prepareStatus(tx, full, words);
    return buildStatusReport(full, authoredFrom(input), {
      sinceLast: status.sinceLast,
      approvedByName,
    });
  });
}

export function parseAuthored(raw: unknown): AuthoredInput | null {
  const parsed = Authored.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
