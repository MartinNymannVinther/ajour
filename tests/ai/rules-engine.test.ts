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
        },
        {
          id: "t2",
          title: "Færdig opgave",
          startDate: "2026-09-01",
          endDate: "2026-09-05",
          state: "done",
        },
      ],
      laterMilestones: [{ id: "m2", title: "I mål", date: "2026-11-01" }],
    });
    expect(res.taskMoves).toHaveLength(1);
    expect(res.taskMoves[0]).toMatchObject({
      id: "t1",
      newStart: "2026-09-17",
      newEnd: "2026-09-27",
    });
    expect(res.milestoneMoves).toEqual([
      { id: "m2", title: "I mål", oldDate: "2026-11-01", newDate: "2026-11-08" },
    ]);
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
        },
      ],
      laterMilestones: [],
    });
    expect(res.taskMoves[0]!.newStart).toBe("2026-09-07");
    expect(res.milestoneMoves).toHaveLength(0);
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
});
