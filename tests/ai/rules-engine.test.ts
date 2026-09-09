import { describe, expect, it } from "vitest";
import { rulesEngine } from "@/modules/ai/rules-engine";
import { chatReplyHasChanges, type ChatContext } from "@/modules/ai/types";

/**
 * The engine that answers when no model is configured or the model fails.
 * It is deterministic on purpose: the three flows must work with the
 * internet cut, which is what dogma two demands.
 */

const context: ChatContext = {
  locale: "da",
  today: "2026-09-01",
  projectName: "Test",
  goal: "",
  ownerName: "",
  managerName: "",
  resources: [],
  milestones: [],
  tasks: [],
  openObstacles: [],
  decisions: [],
  economy: null,
};

describe("the chat forms the rules engine understands", () => {
  it("reads a budget, an obstacle and a decision, and leaves the rest alone", async () => {
    const b = await rulesEngine.chat(context, [], "budget: 90.000");
    expect(b.budgetChange).toEqual({ budget: 90000 });
    const o = await rulesEngine.chat(context, [], "Forhindring: Bussen er aflyst");
    expect(o.newObstacles).toEqual([{ title: "Bussen er aflyst" }]);
    const d = await rulesEngine.chat(context, [], "beslutning: Vi holder det i Aarhus");
    expect(d.newDecisions[0]!.title).toBe("Vi holder det i Aarhus");
    const free = await rulesEngine.chat(context, [], "Er planen realistisk?");
    expect(chatReplyHasChanges(free)).toBe(false);
  });

  it("understands the same forms in English", async () => {
    const en: ChatContext = { ...context, locale: "en" };
    const b = await rulesEngine.chat(en, [], "budget: 90,000");
    expect(b.budgetChange).toEqual({ budget: 90000 });
    const o = await rulesEngine.chat(en, [], "obstacle: the bus is cancelled");
    expect(o.newObstacles).toEqual([{ title: "the bus is cancelled" }]);
    const d = await rulesEngine.chat(en, [], "decision: we meet in Aarhus");
    expect(d.newDecisions[0]!.title).toBe("we meet in Aarhus");
  });
});

describe("a replan", () => {
  it("moves open tasks with the milestone and leaves finished ones standing", async () => {
    const res = await rulesEngine.proposeReplan({
      locale: "da",
      today: "2026-09-01",
      reason: 'Milepælen "Program" er flyttet fra 2026-10-01 til 2026-10-08.',
      deltaDays: 7,
      movedMilestone: {
        id: "m1",
        title: "Program",
        oldDate: "2026-10-01",
        newDate: "2026-10-08",
      },
      affectedTasks: [
        {
          id: "t1",
          title: "Åben opgave",
          startDate: "2026-09-10",
          endDate: "2026-09-20",
          state: "todo",
          owner: "Mette",
          milestoneId: "m1",
        },
        {
          id: "t2",
          title: "Færdig opgave",
          startDate: "2026-09-01",
          endDate: "2026-09-05",
          state: "done",
          owner: "Mette",
          milestoneId: "m1",
        },
      ],
      laterMilestones: [
        {
          id: "m2",
          title: "I mål",
          date: "2026-11-01",
          fixed: false,
          tasks: [
            {
              id: "t3",
              title: "Senere opgave",
              startDate: "2026-10-10",
              endDate: "2026-10-20",
              state: "todo",
              owner: "",
              milestoneId: "m2",
            },
          ],
        },
      ],
      ripple: true,
      otherTasks: [],
    });
    expect(res.taskMoves).toHaveLength(2);
    expect(res.taskMoves[0]).toMatchObject({
      id: "t1",
      newStart: "2026-09-17",
      newEnd: "2026-09-27",
    });
    expect(res.milestoneMoves).toEqual([
      { id: "m2", title: "I mål", oldDate: "2026-11-01", newDate: "2026-11-08" },
    ]);
    // The pushed milestone's own task goes with it.
    expect(res.taskMoves.map((m) => m.id)).toContain("t3");
    expect(res.kept).toContainEqual({
      kind: "task",
      id: "t2",
      title: "Færdig opgave",
      reason: "done",
    });
    expect(res.summary.length).toBeGreaterThan(10);
  });

  it("can pull a milestone forward without touching the later ones", async () => {
    const res = await rulesEngine.proposeReplan({
      locale: "da",
      today: "2026-09-01",
      reason: "Milepælen er flyttet frem.",
      deltaDays: -3,
      movedMilestone: {
        id: "m1",
        title: "Program",
        oldDate: "2026-10-01",
        newDate: "2026-09-28",
      },
      affectedTasks: [
        {
          id: "t1",
          title: "Opgave",
          startDate: "2026-09-10",
          endDate: "2026-09-20",
          state: "doing",
          owner: "",
          milestoneId: "m1",
        },
      ],
      laterMilestones: [],
      ripple: true,
      otherTasks: [],
    });
    expect(res.taskMoves[0]!.newStart).toBe("2026-09-07");
    expect(res.milestoneMoves).toHaveLength(0);
  });

  const task = (id: string, owner: string, start: string, end: string, milestoneId: string) => ({
    id,
    title: id,
    startDate: start,
    endDate: end,
    state: "todo",
    owner,
    milestoneId,
  });

  it("holds a fixed milestone and says so, and holds all of them without the ripple", async () => {
    const base = {
      locale: "da" as const,
      today: "2026-09-01",
      reason: "Flyttet.",
      deltaDays: 7,
      movedMilestone: { id: "m1", title: "Program", oldDate: "2026-10-01", newDate: "2026-10-08" },
      affectedTasks: [task("t1", "Mette", "2026-09-10", "2026-09-20", "m1")],
      laterMilestones: [
        { id: "m2", title: "Konferencen", date: "2026-11-15", fixed: true, tasks: [] },
        { id: "m3", title: "Evaluering", date: "2026-11-30", fixed: false, tasks: [] },
      ],
      otherTasks: [],
    };
    const withRipple = await rulesEngine.proposeReplan({ ...base, ripple: true });
    expect(withRipple.milestoneMoves.map((m) => m.id)).toEqual(["m3"]);
    expect(withRipple.kept).toContainEqual({
      kind: "milestone",
      id: "m2",
      title: "Konferencen",
      reason: "fixed",
    });
    const held = await rulesEngine.proposeReplan({ ...base, ripple: false });
    expect(held.milestoneMoves).toEqual([]);
    expect(held.kept.filter((k) => k.reason === "noRipple")).toHaveLength(2);
  });

  it("warns when a person ends up with three open tasks on the same days", async () => {
    const res = await rulesEngine.proposeReplan({
      locale: "da",
      today: "2026-09-01",
      reason: "Flyttet.",
      deltaDays: 10,
      movedMilestone: { id: "m1", title: "Program", oldDate: "2026-10-01", newDate: "2026-10-11" },
      affectedTasks: [task("t1", "Mette", "2026-09-10", "2026-09-14", "m1")],
      laterMilestones: [],
      ripple: true,
      otherTasks: [
        task("t2", "Mette", "2026-09-20", "2026-09-25", "m2"),
        task("t3", "Mette", "2026-09-22", "2026-09-28", "m2"),
        task("t4", "Jonas", "2026-09-20", "2026-09-25", "m2"),
      ],
    });
    // t1 lands on 20.–24.9., on top of t2 and t3: three at once for Mette.
    expect(res.overloads).toEqual([
      { name: "Mette", count: 3, from: "2026-09-22", to: "2026-09-24" },
    ]);
  });
});

describe("the plan and the status draft", () => {
  it("finds a budget in the project description", async () => {
    const plan = await rulesEngine.generatePlan({
      description: "Vi skal flytte kontoret. Budgettet er 80.000 kr.",
      today: "2026-09-01",
      locale: "da",
    });
    expect(plan.budget).toBe(80000);
    expect(plan.milestones.length).toBeGreaterThan(0);
    expect(plan.tasks.length).toBeGreaterThan(0);
  });

  it("leaves the budget empty when no amount is named", async () => {
    const plan = await rulesEngine.generatePlan({
      description: "Vi holder en konference til foråret.",
      today: "2026-09-01",
      locale: "da",
    });
    expect(plan.budget).toBeNull();
  });

  it("says so in the draft when the plan exceeds the budget", async () => {
    const res = await rulesEngine.draftStatus({
      locale: "da",
      today: "2026-09-01",
      weekLabel: "Uge 36",
      projectName: "Test",
      goal: "",
      nextMilestone: null,
      doneTasks: [],
      doingTasks: [],
      overdueTasks: [],
      openObstacles: [],
      recentActivity: [],
      previousStatus: null,
      economy: { budget: 50000, plannedTotal: 61000, incurredTotal: 20000, postCount: 3 },
      assessment: { rag: "red", reason: "" },
      sinceLast: [],
      progress: { done: 0, total: 4 },
      openAsks: [],
      participantReplies: [],
    });
    expect(res.text).toContain("overstiger budgettet");
    // An overrun is something management has to decide about.
    expect(res.suggestedAsks.map((a) => a.text).join(" ")).toContain("11.000");
  });

  it("names next week's work and asks for help with what is stuck", async () => {
    const res = await rulesEngine.draftStatus({
      locale: "da",
      today: "2026-09-10",
      weekLabel: "Uge 37",
      projectName: "Test",
      goal: "",
      nextMilestone: { title: "Lokale låst", date: "2026-09-22" },
      doneTasks: ["Tema"],
      doingTasks: [{ title: "Vælg lokale", owner: "Mette", endDate: "2026-09-12" }],
      overdueTasks: [
        { title: "Byg side", owner: "Sofie", endDate: "2026-09-05" },
        { title: "Skriv tekst", owner: "", endDate: "2026-09-06" },
      ],
      openObstacles: [{ title: "Lokalet er måske optaget", status: "open" }],
      recentActivity: [],
      previousStatus: null,
      economy: null,
      assessment: { rag: "yellow", reason: "" },
      sinceLast: [],
      progress: { done: 1, total: 4 },
      openAsks: [],
      participantReplies: [],
    });
    expect(res.nextWeek[0]).toContain("Byg side");
    expect(res.nextWeek[0]).toContain("Sofie");
    expect(res.nextWeek.length).toBeLessThanOrEqual(4);
    expect(res.suggestedAsks[0]!.text).toContain("Lokalet er måske optaget");
    expect(res.suggestedAsks.some((a) => a.text.includes("Lokale låst"))).toBe(true);
  });
});

describe("reviseStatus without a model", () => {
  it("adds each answer as one sentence about the thing that was asked", async () => {
    const res = await rulesEngine.reviseStatus({
      locale: "da",
      text: "Alt går efter planen.",
      nextWeek: ["Mette booker lokalet"],
      answers: [
        {
          question: 'Er der nyt om "Lokalet er optaget"?',
          answer: "Mette ejer den, bekræftes fredag",
        },
        { question: "Hvem ejer opsætningen?", answer: "Andreas" },
        { question: "Ubesvaret?", answer: "" },
      ],
      context: {} as never,
    });
    expect(res.text).toBe(
      'Alt går efter planen. Om "Lokalet er optaget": Mette ejer den, bekræftes fredag. Andreas.',
    );
    expect(res.nextWeek).toEqual(["Mette booker lokalet"]);
  });

  it("works what the team said through the link into the words", async () => {
    const res = await rulesEngine.draftStatus({
      locale: "da",
      today: "2026-09-10",
      weekLabel: "Uge 37",
      projectName: "Test",
      goal: "",
      nextMilestone: null,
      doneTasks: [],
      doingTasks: [],
      overdueTasks: [],
      openObstacles: [{ title: "Lokalet er optaget", status: "open" }],
      recentActivity: [],
      previousStatus: null,
      economy: null,
      assessment: { rag: "green", reason: "" },
      sinceLast: [],
      progress: { done: 1, total: 4 },
      openAsks: [],
      participantReplies: [
        {
          name: "Mette",
          kind: "answer",
          about: "Holder datoen?",
          text: "Ja, lokalet er bekræftet.",
        },
      ],
    });
    expect(res.text).toContain("Fra holdet siden sidst");
    expect(res.text).toContain('Mette om "Holder datoen?": Ja, lokalet er bekræftet.');
  });
});
