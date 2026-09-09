import { describe, expect, it } from "vitest";
import { projectHealth, type HealthInput } from "@/modules/projects/health";

/**
 * The colour on the front page, worked out from the plan alone. Red is
 * for what is late or over; yellow for what is about to be; green when
 * nothing is; new when nothing has happened yet.
 */
const base: HealthInput = {
  today: "2026-09-09",
  tasks: [
    { state: "doing", endDate: "2026-09-15", milestoneId: "m1", hasOwner: true },
    { state: "todo", endDate: "2026-09-20", milestoneId: "m1", hasOwner: true },
  ],
  milestones: [{ id: "m1", title: "Lokale låst", date: "2026-09-25", done: false }],
  openObstacles: 0,
  budget: null,
  plannedTotal: 0,
  latestStatusAt: new Date("2026-09-07T10:00:00Z"),
  createdAt: new Date("2026-08-20T10:00:00Z"),
};

describe("projectHealth", () => {
  it("is green when nothing is late, open or missing", () => {
    expect(projectHealth(base)).toEqual({ level: "green", reasons: [] });
  });

  it("is red for an overdue task or a passed milestone, and says how many", () => {
    const late = projectHealth({
      ...base,
      tasks: [{ state: "todo", endDate: "2026-09-01", milestoneId: "m1", hasOwner: true }],
    });
    expect(late.level).toBe("red");
    expect(late.reasons).toContainEqual({ kind: "overdueTasks", count: 1 });
    const passed = projectHealth({
      ...base,
      milestones: [{ id: "m1", title: "M", date: "2026-09-01", done: false }],
    });
    expect(passed.level).toBe("red");
  });

  it("is yellow for a milestone within a week with open work, or an open obstacle", () => {
    const soon = projectHealth({
      ...base,
      milestones: [{ id: "m1", title: "Lokale låst", date: "2026-09-12", done: false }],
    });
    expect(soon.level).toBe("yellow");
    expect(soon.reasons[0]).toMatchObject({ kind: "milestoneSoon", days: 3, open: 2 });
    expect(projectHealth({ ...base, openObstacles: 1 }).level).toBe("yellow");
  });

  it("is red over budget and yellow when no status has been sent for ten days", () => {
    expect(projectHealth({ ...base, budget: 1000, plannedTotal: 1200 }).level).toBe("red");
    const quiet = projectHealth({ ...base, latestStatusAt: new Date("2026-08-25T10:00:00Z") });
    expect(quiet.level).toBe("yellow");
    expect(quiet.reasons).toContainEqual({ kind: "noStatus", days: 15 });
  });

  it("is new for a project a few days old where nothing has started", () => {
    const fresh = projectHealth({
      ...base,
      tasks: base.tasks.map((t) => ({ ...t, state: "todo" })),
      latestStatusAt: null,
      createdAt: new Date("2026-09-07T10:00:00Z"),
    });
    expect(fresh).toEqual({ level: "new", reasons: [] });
  });

  it("flags owners only when at least half the open tasks lack one", () => {
    const half = projectHealth({
      ...base,
      tasks: [
        { state: "todo", endDate: "2026-09-20", milestoneId: "m1", hasOwner: false },
        { state: "todo", endDate: "2026-09-20", milestoneId: "m1", hasOwner: true },
      ],
    });
    expect(half.reasons).toContainEqual({ kind: "noOwner", count: 1 });
    const one = projectHealth({
      ...base,
      tasks: [
        { state: "todo", endDate: "2026-09-20", milestoneId: "m1", hasOwner: false },
        { state: "todo", endDate: "2026-09-20", milestoneId: "m1", hasOwner: true },
        { state: "todo", endDate: "2026-09-20", milestoneId: "m1", hasOwner: true },
      ],
    });
    expect(one.reasons).toEqual([]);
  });
});
