import { and, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { requireOrgContext } from "@/core/auth/guard";
import { weekNumberFromKey } from "@/core/dates";
import { statusUpdates } from "@/core/db/schema";
import { withOrgContext } from "@/core/db/tenant";
import { parseStatusReport } from "@/modules/reports/status-report";
import { renderStatusPdf, type PdfWords } from "@/modules/reports/status-pdf";

/**
 * The status as a PDF, rendered when it is asked for. Nothing is stored:
 * the frozen report is the document, so there is no file to back up, no
 * file to leak, and no file left behind when a workspace is deleted.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; statusId: string }> },
) {
  const context = await requireOrgContext();
  if (!context) return new Response("Unauthorized", { status: 401 });
  const { id, statusId } = await params;

  const row = await withOrgContext(context, async (tx) => {
    const [found] = await tx
      .select()
      .from(statusUpdates)
      .where(and(eq(statusUpdates.id, statusId), eq(statusUpdates.projectId, id)))
      .limit(1);
    return found ?? null;
  });
  if (!row) return new Response("Not found", { status: 404 });
  const report = parseStatusReport(row.details);
  if (!report) return new Response("Not found", { status: 404 });

  const t = await getTranslations("pdf");
  const common = await getTranslations("common");
  const states = await getTranslations("projects.states");
  const week = (key: string) => common("week", { number: weekNumberFromKey(key) });

  const words: PdfWords = {
    statusFor: (key) => t("statusFor", { week: week(key) }),
    goal: t("goal"),
    owner: t("owner"),
    manager: t("manager"),
    plan: t("plan"),
    milestones: t("milestones"),
    tasks: t("tasks"),
    obstacles: t("obstacles"),
    decisions: t("decisions"),
    decisionsSince: (key) => t("decisionsSince", { week: week(key) }),
    economy: t("economy"),
    economyLine: (planned, incurred, budget) => t("economyLine", { planned, incurred, budget }),
    overBudget: t("overBudget"),
    reached: t("reached"),
    open: t("open"),
    criterion: t("criterion"),
    otherTasks: t("otherTasks"),
    none: t("none"),
    since: (date) => t("since", { date }),
    states: { todo: states("todo"), doing: states("doing"), done: states("done") },
    madeWith: t("madeWith"),
  };

  const buffer = await renderStatusPdf(report, words);
  const name = `${report.projectName.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}-${report.weekKey}.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
