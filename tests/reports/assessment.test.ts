import { describe, expect, it } from "vitest";
import { assessProject, type AssessmentInput } from "@/modules/reports/assessment";

/**
 * The colour a steering group acts on, derived the same way every week.
 * Each rule gets the one case that turns it on and the case just short of
 * it, so a change to a threshold shows up here before it shows up in a
 * report.
 */

const base: AssessmentInput = {
  today: "2026-09-10",
  ageDays: 30,
  nextMilestone: { title: "Lokale låst", date: "2026-10-01", taskCount: 3, openCount: 2 },
  overdueTasks: 0,
  overdueExample: "",
  badlyOverdueTasks: 0,
  openObstacles: 0,
  progress: { done: 2, total: 6 },
  economy: null,
};

describe("assessProject", () => {
  it("is early for a plan younger than a week with nothing done", () => {
    expect(assessProject({ ...base, ageDays: 3, progress: { done: 0, total: 5 } }).rag).toBe(
      "early",
    );
    expect(assessProject({ ...base, ageDays: 3, progress: { done: 1, total: 5 } }).rag).toBe(
      "green",
    );
  });

  it("is green when nothing is late, blocked or over", () => {
    const a = assessProject(base);
    expect(a.rag).toBe("green");
    expect(a.reasons).toEqual([{ key: "onTrack" }]);
  });

  it("turns yellow on one late task, red on three", () => {
    expect(assessProject({ ...base, overdueTasks: 1 }).rag).toBe("yellow");
    expect(assessProject({ ...base, overdueTasks: 3 }).rag).toBe("red");
  });

  it("turns yellow on an open obstacle", () => {
    const a = assessProject({ ...base, openObstacles: 1 });
    expect(a.rag).toBe("yellow");
    expect(a.reasons[0]).toEqual({ key: "obstacles", count: 1 });
  });

  it("turns red when the next milestone has passed", () => {
    const a = assessProject({
      ...base,
      nextMilestone: { title: "Lokale låst", date: "2026-09-01", taskCount: 3, openCount: 1 },
    });
    expect(a.rag).toBe("red");
    expect(a.reasons[0]).toEqual({
      key: "milestoneMissed",
      title: "Lokale låst",
      date: "2026-09-01",
      days: 9,
    });
  });

  it("puts the milestone at risk when it is close and something is already late", () => {
    const a = assessProject({
      ...base,
      nextMilestone: { title: "Lokale låst", date: "2026-09-20", taskCount: 3, openCount: 2 },
      overdueTasks: 1,
      overdueExample: "Byg side",
    });
    expect(a.rag).toBe("yellow");
    expect(a.reasons[0]).toEqual({
      key: "milestoneAtRisk",
      title: "Lokale låst",
      date: "2026-09-20",
      days: 10,
      open: 2,
    });
  });

  it("reads the money: over budget is red, spend well ahead of work is yellow", () => {
    expect(
      assessProject({
        ...base,
        economy: { budget: 50000, plannedTotal: 61000, incurredTotal: 10000 },
      }).rag,
    ).toBe("red");
    const ahead = assessProject({
      ...base,
      economy: { budget: 60000, plannedTotal: 53000, incurredTotal: 45000 },
      progress: { done: 4, total: 9 },
    });
    expect(ahead.rag).toBe("yellow");
    expect(ahead.reasons[0]).toEqual({ key: "spendAhead", spendPercent: 75, workPercent: 44 });
    // A little ahead is normal for a project that pays deposits first.
    expect(
      assessProject({
        ...base,
        economy: { budget: 60000, plannedTotal: 53000, incurredTotal: 30000 },
        progress: { done: 4, total: 9 },
      }).rag,
    ).toBe("green");
  });

  it("keeps the worst colour and every reason", () => {
    const a = assessProject({ ...base, overdueTasks: 1, openObstacles: 2 });
    expect(a.rag).toBe("yellow");
    expect(a.reasons.map((r) => r.key)).toEqual(["overdue", "obstacles"]);
  });
});
