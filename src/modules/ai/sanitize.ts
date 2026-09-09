import type { ChatContext, ChatReply } from "./types";
import { emptyChatReply } from "./types";
import { asAmount, asBool, asIso, asNames, asString, list, present, rec } from "./sanitize-helpers";

export { asIso, asString } from "./sanitize-helpers";
export { sanitizePlan } from "./sanitize-plan";

/**
 * The boundary between a model and the database. Raw model output goes in;
 * only known ids, valid dates, sane amounts and legal states come out, and
 * nothing that could delete. A model can be confused, or talked into
 * something by text in a task title; neither may reach a row.
 */

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
      const incurred = asBool(ee.incurred) ?? false;
      const spent = ee.spent === undefined ? (incurred ? amount : 0) : (asAmount(ee.spent) ?? 0);
      return { title, amount, spent, incurred: spent >= amount, taskId };
    }),
  ).slice(0, 10);
  out.expenseChanges = present(
    list(r.expenseChanges).map((ec) => {
      const e = expenseById.get(asString(ec.id, "", 64));
      if (!e) return null;
      const incurred = asBool(ec.incurred);
      const amount = ec.amount === undefined ? null : asAmount(ec.amount);
      const spent = ec.spent === undefined ? null : asAmount(ec.spent);
      if (
        (incurred === null || incurred === e.incurred) &&
        (amount === null || amount === e.amount) &&
        (spent === null || spent === e.spent)
      )
        return null;
      return { id: e.id, title: e.title, incurred, amount, spent };
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
