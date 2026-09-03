/**
 * The colours a project page uses to tell its functions apart. They are
 * the Haij 2a tokens, not new colours: one palette for the whole family,
 * so a person who knows Haij is not learning a second visual language.
 *
 * Each function gets a left edge in its own colour. Meaning never rests on
 * colour alone — every state that matters is also written in words.
 */
export const FUNCTION_ACCENT = {
  plan: "var(--primary)",
  economy: "var(--chart-4)",
  obstacles: "var(--destructive)",
  decisions: "var(--chart-2)",
  statuses: "var(--success)",
  people: "var(--chart-3)",
  history: "var(--label)",
} as const;

export type FunctionKey = keyof typeof FUNCTION_ACCENT;

/** The anchors the overview tiles jump to; also the ids in the markup. */
export const SECTION_IDS = {
  plan: "section-plan",
  milestones: "section-milestones",
  tasks: "section-tasks",
  economy: "section-economy",
  obstacles: "section-obstacles",
  decisions: "section-decisions",
  statuses: "section-statuses",
  people: "section-people",
  history: "section-history",
} as const;

/** The datalist every person field reads from, so names are reused, not retyped. */
export const PEOPLE_LIST_ID = "ajour-people";

/** Timeline zoom steps in pixels per day, from a quarter to a fortnight. */
export const ZOOM_LEVELS = [8, 16, 28] as const;
