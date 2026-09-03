import { addDaysIso, ISO_DATE } from "@/core/dates";
import type { ChatContext, ChatReply, PlanProposal } from "./types";
import { emptyChatReply } from "./types";

/**
 * The boundary between a model and the database. Raw model output goes in;
 * only known ids, valid dates, sane amounts and legal states come out, and
 * nothing that could delete. A model can be confused, or talked into
 * something by text in a task title; neither may reach a row.
 */

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v ?? {}) as Rec;
const list = (v: unknown): Rec[] => (Array.isArray(v) ? v.map(rec) : []);

/** Strips control characters and caps length; text from a model is data. */
export function asString(v: unknown, fallback = "", max = 2000): string {
  if (typeof v !== "string") return fallback;
  return v
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

export function asIso(v: unknown, fallback: string): string {
  const s = asString(v, "", 10);
  return ISO_DATE.test(s) ? s : fallback;
}

function asAmount(v: unknown): number | null {
  // Danish number formats in text: "75.000 kr." and "1.250,50" read as whole kroner.
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string"
        ? Number(v.replace(/,\d+\s*(kr\.?)?$/i, "").replace(/\D/g, ""))
        : NaN;
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 999_999_999) : null;
}

function asBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "ja" || v === "yes") return true;
  if (v === "false" || v === "nej" || v === "no") return false;
  return null;
}

function asNames(v: unknown, max: number): string[] | null {
  if (!Array.isArray(v)) return null;
  return [...new Set(v.map((x) => asString(x, "", 40)).filter(Boolean))].slice(0, max);
}

function present<T>(xs: (T | null)[]): T[] {
  return xs.filter((x): x is T => x !== null);
}

export function sanitizeChatReply(raw: unknown, context: ChatContext): ChatReply | null {
  const r = rec(raw);
  const reply = asString(r.reply, "", 4000);
  if (!reply) return null;

  const taskById = new Map(context.tasks.map((t) => [t.id, t]));
  const msById = new Map(context.milestones.map((m) => [m.id, m]));
  const obstacleById = new Map(context.openObstacles.map((o) => [o.id, o]));
  const expenseById = new Map((context.economy?.expenses ?? []).map((e) => [e.id, e]));
  const out = emptyChatReply(reply);

  out.taskMoves = present(
    list(r.taskMoves).map((mm) => {
      const t = taskById.get(asString(mm.id, "", 64));
      if (!t) return null;
      let newStart = asIso(mm.newStart, t.startDate);
      let newEnd = asIso(mm.newEnd, t.endDate);
      if (newEnd < newStart) [newStart, newEnd] = [newEnd, newStart];
      if (newStart === t.startDate && newEnd === t.endDate) return null;
      return {
        id: t.id,
        title: t.title,
        oldStart: t.startDate,
        oldEnd: t.endDate,
        newStart,
        newEnd,
      };
    }),
  ).slice(0, 15);

  out.milestoneMoves = present(
    list(r.milestoneMoves).map((mm) => {
      const ms = msById.get(asString(mm.id, "", 64));
      if (!ms) return null;
      const newDate = asIso(mm.newDate, ms.date);
      if (newDate === ms.date) return null;
      return { id: ms.id, title: ms.title, oldDate: ms.date, newDate };
    }),
  ).slice(0, 6);

  out.newTasks = present(
    list(r.newTasks).map((tt) => {
      const title = asString(tt.title, "", 100);
      if (!title) return null;
      const milestoneId = msById.has(asString(tt.milestoneId, "", 64))
        ? asString(tt.milestoneId, "", 64)
        : null;
      let startDate = asIso(tt.startDate, context.today);
      let endDate = asIso(tt.endDate, startDate);
      if (endDate < startDate) [startDate, endDate] = [endDate, startDate];
      return { title, milestoneId, owner: asString(tt.owner, "", 40), startDate, endDate };
    }),
  ).slice(0, 10);

  out.newMilestones = present(
    list(r.newMilestones).map((mm) => {
      const title = asString(mm.title, "", 80);
      return title ? { title, date: asIso(mm.date, context.today) } : null;
    }),
  ).slice(0, 4);

  out.stateChanges = present(
    list(r.stateChanges).map((ss) => {
      const t = taskById.get(asString(ss.id, "", 64));
      const state = asString(ss.state, "", 10);
      if (!t || !["todo", "doing", "done"].includes(state) || t.state === state) return null;
      return { id: t.id, title: t.title, state: state as "todo" | "doing" | "done" };
    }),
  ).slice(0, 15);

  out.milestoneChanges = present(
    list(r.milestoneChanges).map((mc) => {
      const t = taskById.get(asString(mc.id, "", 64));
      if (!t) return null;
      const target =
        mc.milestoneId === null
          ? null
          : msById.has(asString(mc.milestoneId, "", 64))
            ? asString(mc.milestoneId, "", 64)
            : undefined;
      if (target === undefined || target === t.milestoneId) return null;
      return {
        id: t.id,
        title: t.title,
        milestoneId: target,
        milestoneTitle: target ? msById.get(target)!.title : null,
      };
    }),
  ).slice(0, 15);

  out.newDecisions = present(
    list(r.newDecisions).map((dd) => {
      const title = asString(dd.title, "", 120);
      return title ? { title, note: asString(dd.note, "", 400) } : null;
    }),
  ).slice(0, 5);

  const bc = r.budgetChange;
  if (bc && typeof bc === "object") {
    const b = rec(bc).budget;
    const budget = b === null ? null : asAmount(b);
    if (b === null || budget !== null) out.budgetChange = { budget };
  }
  out.newExpenses = present(
    list(r.newExpenses).map((ee) => {
      const title = asString(ee.title, "", 100);
      const amount = asAmount(ee.amount);
      if (!title || amount === null) return null;
      const taskId = taskById.has(asString(ee.taskId, "", 64)) ? asString(ee.taskId, "", 64) : null;
      return { title, amount, incurred: asBool(ee.incurred) ?? false, taskId };
    }),
  ).slice(0, 10);
  out.expenseChanges = present(
    list(r.expenseChanges).map((ec) => {
      const e = expenseById.get(asString(ec.id, "", 64));
      if (!e) return null;
      const incurred = asBool(ec.incurred);
      const amount = ec.amount === undefined ? null : asAmount(ec.amount);
      if (
        (incurred === null || incurred === e.incurred) &&
        (amount === null || amount === e.amount)
      )
        return null;
      return { id: e.id, title: e.title, incurred, amount };
    }),
  ).slice(0, 10);

  out.newObstacles = present(
    list(r.newObstacles).map((oo) => {
      const title = asString(oo.title, "", 160);
      return title ? { title } : null;
    }),
  ).slice(0, 5);
  out.resolvedObstacles = present(
    list(r.resolvedObstacles).map((ro) => {
      const o = obstacleById.get(asString(ro.id, "", 64));
      return o ? { id: o.id, title: o.title } : null;
    }),
  ).slice(0, 10);

  out.subtaskChanges = present(
    list(r.subtaskChanges).map((sc) => {
      const t = taskById.get(asString(sc.id, "", 64));
      if (!t || !Array.isArray(sc.subtasks)) return null;
      const subtasks = present(
        sc.subtasks.map(rec).map((st) => {
          const title = asString(st.title, "", 120);
          return title ? { title, done: asBool(st.done) ?? false } : null;
        }),
      ).slice(0, 20);
      return { id: t.id, title: t.title, subtasks };
    }),
  ).slice(0, 10);
  out.peopleChanges = present(
    list(r.peopleChanges).map((pc) => {
      const t = taskById.get(asString(pc.id, "", 64));
      if (!t) return null;
      const owner = typeof pc.owner === "string" ? asString(pc.owner, "", 40) : null;
      const participants = asNames(pc.participants, 12);
      if (owner === null && participants === null) return null;
      return { id: t.id, title: t.title, owner, participants };
    }),
  ).slice(0, 15);

  out.milestoneUpdates = present(
    list(r.milestoneUpdates).map((mu) => {
      const m = msById.get(asString(mu.id, "", 64));
      if (!m) return null;
      const newTitle =
        typeof mu.newTitle === "string" && asString(mu.newTitle)
          ? asString(mu.newTitle, "", 80)
          : null;
      const ownerName = typeof mu.ownerName === "string" ? asString(mu.ownerName, "", 40) : null;
      const criterion = typeof mu.criterion === "string" ? asString(mu.criterion, "", 300) : null;
      const done = asBool(mu.done);
      if (
        newTitle === null &&
        ownerName === null &&
        criterion === null &&
        (done === null || done === m.done)
      )
        return null;
      return {
        id: m.id,
        title: m.title,
        newTitle,
        ownerName,
        criterion,
        done: done === m.done ? null : done,
      };
    }),
  ).slice(0, 10);

  const rc = r.roleChanges;
  if (rc && typeof rc === "object") {
    const ownerName =
      typeof rec(rc).ownerName === "string" ? asString(rec(rc).ownerName, "", 40) : null;
    const managerName =
      typeof rec(rc).managerName === "string" ? asString(rec(rc).managerName, "", 40) : null;
    if (ownerName !== null || managerName !== null) out.roleChanges = { ownerName, managerName };
  }
  out.newResources = (asNames(r.newResources, 10) ?? []).filter(
    (n) => !context.resources.includes(n),
  );

  return out;
}

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
