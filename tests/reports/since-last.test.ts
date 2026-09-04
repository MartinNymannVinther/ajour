import { describe, expect, it } from "vitest";
import { condenseSinceLast, type SinceLastWords } from "@/modules/reports/since-last";

const words: SinceLastWords = {
  tasksDone: (n, ex) => `done:${n}:${ex}`,
  tasksMoved: (n, ex) => `moved:${n}:${ex}`,
  milestonesReached: (t) => `reached:${t}`,
  milestonesChanged: (t) => `changed:${t}`,
  obstaclesAdded: (n, ex) => `obstacle+:${n}:${ex}`,
  obstaclesResolved: (n, ex) => `obstacle-:${n}:${ex}`,
  decisions: (n, ex) => `decision:${n}:${ex}`,
  budgetSet: (a) => `budget:${a}`,
  nothing: "nothing",
};

const ev = (type: string, payload: Record<string, unknown>) => ({ type, payload });

describe("condenseSinceLast", () => {
  it("turns a week of events into a few lines, milestones first", () => {
    const lines = condenseSinceLast(
      [
        ev("task.state", { title: "A", state: "done" }),
        ev("task.state", { title: "B", state: "done" }),
        ev("task.state", { title: "C", state: "doing" }),
        ev("milestone.done", { title: "Lokale låst" }),
        ev("obstacle.added", { title: "Optaget" }),
        ev("decision.added", { title: "Keynote" }),
        ev("budget.set", { amount: 60000 }),
      ],
      words,
    );
    expect(lines[0]).toBe("reached:Lokale låst");
    expect(lines).toContain("done:2:A");
    expect(lines).toContain("obstacle+:1:Optaget");
    expect(lines).toContain("decision:1:Keynote");
    expect(lines).toContain("budget:60000");
  });

  it("does not count a task as done when it was reopened afterwards", () => {
    const lines = condenseSinceLast(
      [
        ev("task.state", { title: "A", state: "done" }),
        ev("task.state", { title: "A", state: "doing" }),
      ],
      words,
    );
    expect(lines).toEqual([]);
  });

  it("counts a task moved twice once", () => {
    const lines = condenseSinceLast(
      [
        ev("task.moved", { title: "A" }),
        ev("task.moved", { title: "A" }),
        ev("task.moved", { title: "B" }),
      ],
      words,
    );
    expect(lines).toEqual(["moved:2:A"]);
  });

  it("never says more than six things", () => {
    const rows = [
      ev("milestone.done", { title: "M" }),
      ev("task.state", { title: "A", state: "done" }),
      ev("obstacle.added", { title: "O" }),
      ev("obstacle.resolved", { title: "P" }),
      ev("milestone.updated", { title: "M2" }),
      ev("task.moved", { title: "T" }),
      ev("decision.added", { title: "D" }),
      ev("budget.set", { amount: 1 }),
    ];
    expect(condenseSinceLast(rows, words)).toHaveLength(6);
  });
});
