import { addDaysIso } from "@/core/dates";
import type { PlanProposal } from "./types";
import { asIso, asString, rec, type Rec } from "./sanitize-helpers";

/** A plan from a model, repaired where it is odd and refused where it is empty. */
export function sanitizePlan(
  raw: unknown,
  today: string,
  fallbackName: string,
): PlanProposal | null {
  if (typeof raw !== "object" || raw === null) return null;
  let r = raw as Rec;
  // Some models wrap the answer, e.g. {"plan": {...}}; dig one level down.
  if (!Array.isArray(r.milestones)) {
    const nested = Object.values(r).find(
      (v) => typeof v === "object" && v !== null && Array.isArray((v as Rec).milestones),
    );
    if (nested) r = nested as Rec;
  }
  const msRaw = Array.isArray(r.milestones) ? r.milestones : [];
  const tasksRaw = Array.isArray(r.tasks) ? r.tasks : [];
  if (msRaw.length === 0 || tasksRaw.length === 0) return null;

  const milestones = msRaw.slice(0, 6).map((m, i) => {
    const mm = rec(m);
    return {
      title: asString(mm.title, `Milestone ${i + 1}`, 80),
      date: asIso(mm.date, addDaysIso(today, (i + 1) * 21)),
    };
  });
  const tasks = tasksRaw.slice(0, 20).map((t, i) => {
    const tt = rec(t);
    const idx =
      typeof tt.milestoneIndex === "number" &&
      tt.milestoneIndex >= 0 &&
      tt.milestoneIndex < milestones.length
        ? Math.floor(tt.milestoneIndex)
        : null;
    let start = asIso(tt.startDate, addDaysIso(today, 1 + i * 3));
    let end = asIso(tt.endDate, addDaysIso(start, 6));
    if (end < start) [start, end] = [end, start];
    return {
      title: asString(tt.title, `Task ${i + 1}`, 100),
      milestoneIndex: idx,
      owner: asString(tt.owner, "", 40),
      startDate: start,
      endDate: end,
    };
  });
  const budgetRaw = r.budget;
  const budget =
    typeof budgetRaw === "number" && Number.isFinite(budgetRaw) && budgetRaw > 0
      ? Math.min(Math.round(budgetRaw), 999_999_999)
      : null;
  return {
    name: asString(r.name, fallbackName, 80),
    goal: asString(r.goal, "", 300),
    budget,
    milestones,
    tasks,
  };
}
