import type { StatusReport } from "./status-report";

/**
 * What the approved summary would give away to somebody holding a share
 * link.
 *
 * A share link's read is cut down to an allow-list (see
 * `publicReport` in modules/share/service.ts): no budget, no obstacle
 * list, no management asks, no decisions. But the summary itself travels
 * with the link, word for word as it was approved — and the engine that
 * writes it puts the budget in a sentence and names the open obstacles,
 * because that is what a status for a manager is for.
 *
 * So the cut is real and the promise around it is not the whole truth.
 * The honest answer is not to censor a manager's own words; it is to tell
 * them, while they can still edit, what the sentence in front of them
 * will say to a stranger. That is what this is for.
 *
 * Deliberately literal rather than clever. It reports what it can point
 * at — this figure, that obstacle title — and says nothing about prose it
 * cannot recognise. A false alarm costs a reading; a missed one costs a
 * budget, so the money check also takes any bare amount followed by a
 * currency word, which catches a model that reworded the sentence.
 */

export type SharedTextWarning = {
  /** Money figures from the report that appear in the summary, as written. */
  money: string[];
  /** Obstacle titles from the report that appear in the summary. */
  obstacles: string[];
};

const CURRENCY = /\b\d[\d.,\s]*\s?(kr\.?|DKK|EUR|€)\b/gi;

function amountsIn(report: StatusReport, money: (n: number) => string): string[] {
  const e = report.economy;
  if (!e) return [];
  const figures = [e.budget, e.plannedTotal, e.incurredTotal].filter(
    (n): n is number => typeof n === "number" && n > 0,
  );
  return [...new Set(figures.map(money))];
}

export function sharedTextWarning(
  text: string,
  report: StatusReport,
  money: (n: number) => string,
): SharedTextWarning | null {
  const haystack = text.toLowerCase();

  const named = amountsIn(report, money).filter((f) => haystack.includes(f.toLowerCase()));
  // A model that wrote "roughly 45,000 kr." instead of the exact figure
  // is still saying the budget out loud.
  const loose = report.economy ? (text.match(CURRENCY) ?? []).map((m) => m.trim()) : [];
  const money_ = [...new Set([...named, ...loose])];

  const obstacles = report.obstacles
    .map((o) => o.title)
    .filter((title) => title.trim().length > 2 && haystack.includes(title.trim().toLowerCase()));

  if (money_.length === 0 && obstacles.length === 0) return null;
  return { money: money_, obstacles };
}
