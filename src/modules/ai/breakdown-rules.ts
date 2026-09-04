import { addDaysIso, diffDays } from "@/core/dates";
import { PROJECT_TEMPLATES } from "@/modules/projects/templates";
import { PHRASES } from "./phrases";
import type { BreakdownInput, TaskProposal } from "./types";

/**
 * A milestone broken into tasks without a model. First choice: a template
 * milestone whose title shares its words with this one, because the five
 * templates already say what "supplier chosen" or "programme published"
 * takes. Otherwise the four moves every milestone takes — work it out,
 * plan it, do it, check it — laid across the window in that order.
 */

const STOP = new Set([
  "og",
  "i",
  "på",
  "til",
  "af",
  "er",
  "en",
  "et",
  "den",
  "det",
  "for",
  "med",
  "the",
  "and",
  "in",
  "of",
  "to",
  "a",
  "is",
  "on",
  "for",
  "with",
]);

function significant(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

/** Shares of the window each phase takes, and how far from the start each begins. */
const PHASES: Array<[number, number]> = [
  [0, 0.15],
  [0.1, 0.3],
  [0.25, 0.85],
  [0.8, 1],
];

export function ruleBreakdown(input: BreakdownInput): TaskProposal[] {
  const { locale, milestone } = input;
  const start = input.windowStart <= milestone.date ? input.windowStart : milestone.date;
  const span = Math.max(4, diffDays(start, milestone.date));
  const at = (share: number) => addDaysIso(start, Math.round(span * share));
  const owner = milestone.ownerName || input.people[0] || "";
  const existing = new Set(input.existingTasks.map((t) => t.toLowerCase()));

  const words = significant(milestone.title);
  let best: { score: number; tasks: TaskProposal[] } | null = null;
  for (const template of PROJECT_TEMPLATES) {
    template.milestones.forEach((m, index) => {
      const overlap = [...significant(m.title[locale])].filter((w) => words.has(w)).length;
      if (overlap === 0 || (best && overlap <= best.score)) return;
      const own = template.tasks.filter((t) => t.m === index);
      if (own.length === 0) return;
      const first = Math.min(...own.map((t) => t.start));
      const last = Math.max(...own.map((t) => t.end));
      const scale = span / Math.max(1, last - first);
      best = {
        score: overlap,
        tasks: own.map((t) => ({
          title: t.title[locale],
          owner,
          startDate: addDaysIso(start, Math.round((t.start - first) * scale)),
          endDate: addDaysIso(start, Math.round((t.end - first) * scale)),
        })),
      };
    });
  }

  const proposals: TaskProposal[] =
    best !== null
      ? (best as { tasks: TaskProposal[] }).tasks
      : PHRASES[locale].breakdown.map((phrase, i) => ({
          title: phrase(milestone.title),
          owner,
          startDate: at(PHASES[i]![0]),
          endDate: at(PHASES[i]![1]),
        }));

  return proposals
    .filter((p) => !existing.has(p.title.toLowerCase()))
    .map((p) => ({ ...p, endDate: p.endDate > milestone.date ? milestone.date : p.endDate }))
    .slice(0, 7);
}
