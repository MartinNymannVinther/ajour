import { getLocale, getTranslations } from "next-intl/server";
import { weekNumberFromKey } from "@/core/dates";
import { formatMoney } from "@/modules/ai/phrases";
import type { Locale } from "@/modules/ai/types";
import { reportWords, type ReportWords } from "./words";

/** The report's words on the server, in the caller's language. */
export async function serverReportWords(): Promise<ReportWords> {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("report");
  const common = await getTranslations("common");
  const states = await getTranslations("projects.states");
  return reportWords(
    t,
    (key) => common("week", { number: weekNumberFromKey(key) }),
    { todo: states("todo"), doing: states("doing"), done: states("done") },
    (n) => formatMoney(n, locale),
  );
}

export function pdfFileName(projectName: string, weekKey: string, draft = false): string {
  const slug = projectName.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase();
  return `${slug}-${weekKey}${draft ? "-udkast" : ""}.pdf`;
}
