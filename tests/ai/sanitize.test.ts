import { describe, expect, it } from "vitest";
import { sanitizeChatReply, sanitizePlan } from "@/modules/ai/sanitize";
import { chatReplyHasChanges, type ChatContext } from "@/modules/ai/types";

/**
 * The boundary a model writes through. Everything here is a claim about
 * what cannot reach the database: unknown ids, illegal states, nonsense
 * amounts, empty titles, control characters.
 */

const context: ChatContext = {
  locale: "da",
  today: "2026-09-01",
  projectName: "Test",
  goal: "",
  ownerName: "",
  managerName: "",
  resources: ["Mette"],
  milestones: [
    { id: "m1", title: "Milepæl", date: "2026-10-01", done: false, ownerName: "", criterion: "" },
  ],
  tasks: [
    {
      id: "t1",
      title: "Opgave A",
      state: "todo",
      owner: "",
      participants: [],
      startDate: "2026-09-05",
      endDate: "2026-09-10",
      milestoneId: "m1",
      subtasks: [],
    },
  ],
  openObstacles: [{ id: "o1", title: "Lokalet er optaget", status: "open" }],
  decisions: [],
  economy: {
    budget: 50000,
    plannedTotal: 10000,
    incurredTotal: 0,
    expenses: [{ id: "e1", title: "Depositum", amount: 10000, incurred: false, taskId: null }],
  },
};

describe("sanitizeChatReply", () => {
  it("accepts moves, new tasks, state changes and decisions that name real rows", () => {
    const r = sanitizeChatReply(
      {
        reply: "Gjort.",
        taskMoves: [{ id: "t1", newStart: "2026-09-12", newEnd: "2026-09-17" }],
        newTasks: [
          {
            title: "Design Sprint workshop",
            milestoneId: "m1",
            owner: "Jonas",
            startDate: "2026-09-20",
            endDate: "2026-09-24",
          },
        ],
        stateChanges: [{ id: "t1", state: "doing" }],
        newDecisions: [
          {
            title: "Workshoppen holdes før prototypen",
            note: "Så designet ligger fast før byggeriet.",
          },
        ],
      },
      context,
    );
    expect(r).not.toBeNull();
    expect(r!.taskMoves).toHaveLength(1);
    expect(r!.taskMoves[0]).toMatchObject({ id: "t1", title: "Opgave A", oldStart: "2026-09-05" });
    expect(r!.newTasks[0]!.milestoneId).toBe("m1");
    expect(r!.stateChanges[0]!.state).toBe("doing");
    expect(r!.newDecisions[0]!.title).toContain("Workshoppen");
  });

  it("drops unknown ids, illegal states and unknown milestones", () => {
    const r = sanitizeChatReply(
      {
        reply: "Ok.",
        taskMoves: [{ id: "findes-ikke", newStart: "2026-09-12", newEnd: "2026-09-17" }],
        newTasks: [
          {
            title: "Ny",
            milestoneId: "findes-ikke",
            startDate: "2026-09-02",
            endDate: "2026-09-04",
          },
        ],
        stateChanges: [{ id: "t1", state: "kaput" }],
      },
      context,
    );
    expect(r!.taskMoves).toHaveLength(0);
    expect(r!.newTasks[0]!.milestoneId).toBeNull();
    expect(r!.stateChanges).toHaveLength(0);
    expect(chatReplyHasChanges(r!)).toBe(true);
  });

  it("reads money the way people write it, and refuses the rest", () => {
    const r = sanitizeChatReply(
      {
        reply: "Ok.",
        budgetChange: { budget: "75.000 kr." },
        newExpenses: [
          { title: "Forplejning", amount: 12000, incurred: false, taskId: "t1" },
          { title: "Uden beløb" },
          { title: "Ukendt opgave", amount: 500, taskId: "nope" },
        ],
        expenseChanges: [
          { id: "e1", incurred: true },
          { id: "e1", incurred: false },
          { id: "nope", amount: 1 },
        ],
      },
      context,
    );
    expect(r!.budgetChange).toEqual({ budget: 75000 });
    expect(r!.newExpenses).toHaveLength(2);
    expect(r!.newExpenses[0]!.taskId).toBe("t1");
    expect(r!.newExpenses[1]!.taskId).toBeNull();
    expect(r!.expenseChanges).toEqual([
      { id: "e1", title: "Depositum", incurred: true, amount: null },
    ]);
  });

  it("removes a budget with null, but not with words", () => {
    expect(
      sanitizeChatReply({ reply: "x", budgetChange: { budget: null } }, context)!.budgetChange,
    ).toEqual({ budget: null });
    expect(
      sanitizeChatReply({ reply: "x", budgetChange: { budget: "mange" } }, context)!.budgetChange,
    ).toBeNull();
  });

  it("relinks tasks only to milestones that exist", () => {
    const r = sanitizeChatReply(
      {
        reply: "Ok.",
        milestoneChanges: [
          { id: "t1", milestoneId: null },
          { id: "t1", milestoneId: "nope" },
          { id: "t1", milestoneId: "m1" },
        ],
      },
      context,
    );
    expect(r!.milestoneChanges).toEqual([
      { id: "t1", title: "Opgave A", milestoneId: null, milestoneTitle: null },
    ]);
  });

  it("handles obstacles, checklists, people, milestones, roles and resources", () => {
    const r = sanitizeChatReply(
      {
        reply: "Ok.",
        newObstacles: [{ title: "Oplægsholder har meldt afbud" }, { title: "" }],
        resolvedObstacles: [{ id: "o1" }, { id: "nope" }],
        subtaskChanges: [
          {
            id: "t1",
            subtasks: [
              { title: "Ring til udlejer", done: true },
              { title: "" },
              { title: "Send kontrakt" },
            ],
          },
        ],
        peopleChanges: [
          { id: "t1", owner: "Mette", participants: ["Jonas", "Jonas", ""] },
          { id: "t1" },
        ],
        milestoneUpdates: [
          { id: "m1", criterion: "Kontrakten er underskrevet", done: true },
          { id: "m1", done: false },
        ],
        roleChanges: { managerName: "Lise" },
        newResources: ["Mette", "Karim"],
      },
      context,
    );
    expect(r!.newObstacles).toEqual([{ title: "Oplægsholder har meldt afbud" }]);
    expect(r!.resolvedObstacles).toEqual([{ id: "o1", title: "Lokalet er optaget" }]);
    expect(r!.subtaskChanges[0]!.subtasks).toEqual([
      { title: "Ring til udlejer", done: true },
      { title: "Send kontrakt", done: false },
    ]);
    expect(r!.peopleChanges).toEqual([
      { id: "t1", title: "Opgave A", owner: "Mette", participants: ["Jonas"] },
    ]);
    expect(r!.milestoneUpdates).toHaveLength(1);
    expect(r!.milestoneUpdates[0]).toMatchObject({
      criterion: "Kontrakten er underskrevet",
      done: true,
      newTitle: null,
    });
    expect(r!.roleChanges).toEqual({ ownerName: null, managerName: "Lise" });
    expect(r!.newResources).toEqual(["Karim"]);
  });

  it("strips control characters out of anything a model writes", () => {
    const r = sanitizeChatReply(
      { reply: `Hej${"\u0000"}verden`, newObstacles: [{ title: `A${"\u001B"}B` }] },
      context,
    );
    expect(r!.reply).toBe("Hejverden");
    expect(r!.newObstacles[0]!.title).toBe("AB");
  });

  it("refuses a reply with no text at all", () => {
    expect(sanitizeChatReply({ taskMoves: [] }, context)).toBeNull();
    expect(sanitizeChatReply(null, context)).toBeNull();
    expect(sanitizeChatReply("bare tekst", context)).toBeNull();
  });
});

describe("sanitizePlan", () => {
  it("accepts a sensible plan", () => {
    const plan = sanitizePlan(
      {
        name: "Testprojekt",
        goal: "I mål",
        milestones: [{ title: "M1", date: "2026-10-01" }],
        tasks: [
          {
            title: "T1",
            milestoneIndex: 0,
            owner: "Mette",
            startDate: "2026-09-05",
            endDate: "2026-09-10",
          },
        ],
      },
      "2026-09-01",
      "Nyt projekt",
    );
    expect(plan).not.toBeNull();
    expect(plan!.tasks[0]!.milestoneIndex).toBe(0);
  });

  it("repairs crooked dates and indexes instead of failing", () => {
    const plan = sanitizePlan(
      {
        name: "X",
        milestones: [{ title: "M1", date: "ikke en dato" }],
        tasks: [
          { title: "T1", milestoneIndex: 99, startDate: "2026-09-10", endDate: "2026-09-05" },
        ],
      },
      "2026-09-01",
      "Nyt projekt",
    );
    expect(plan).not.toBeNull();
    expect(plan!.milestones[0]!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(plan!.tasks[0]!.milestoneIndex).toBeNull();
    expect(plan!.tasks[0]!.startDate <= plan!.tasks[0]!.endDate).toBe(true);
  });

  it("unwraps a plan the model put in a box", () => {
    const plan = sanitizePlan(
      {
        plan: {
          name: "Indpakket",
          goal: "I mål",
          milestones: [{ title: "M1", date: "2026-10-01" }],
          tasks: [
            {
              title: "T1",
              milestoneIndex: 0,
              owner: "",
              startDate: "2026-09-05",
              endDate: "2026-09-10",
            },
          ],
        },
      },
      "2026-09-01",
      "Nyt projekt",
    );
    expect(plan!.name).toBe("Indpakket");
  });

  it("refuses an empty plan", () => {
    expect(
      sanitizePlan({ name: "X", milestones: [], tasks: [] }, "2026-09-01", "Nyt projekt"),
    ).toBeNull();
    expect(sanitizePlan(null, "2026-09-01", "Nyt projekt")).toBeNull();
  });
});
