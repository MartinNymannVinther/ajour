import { describe, expect, it } from "vitest";
import { rulesEngine } from "@/modules/ai/rules-engine";
import { fallbackTip, observeProject } from "@/modules/ai/tip-rules";
import type { ChatContext, TipInput } from "@/modules/ai/types";

/**
 * The daily tip: what the plan itself says, before any model sees it. The
 * observations are also what the LLM engine is handed, so a model that
 * fails still leaves the user with the same reading of the plan.
 */

const base: ChatContext = {
  locale: "da",
  today: "2026-09-03",
  projectName: "Test",
  goal: "",
  ownerName: "",
  managerName: "",
  resources: [],
  milestones: [
    {
      id: "m1",
      title: "Program klar",
      date: "2026-09-08",
      done: false,
      ownerName: "Jonas",
      criterion: "",
    },
  ],
  tasks: [
    {
      id: "t1",
      title: "Skriv program",
      state: "doing",
      owner: "Jonas",
      participants: [],
      startDate: "2026-08-25",
      endDate: "2026-09-01",
      milestoneId: "m1",
      subtasks: [],
    },
    {
      id: "t2",
      title: "Book lokale",
      state: "todo",
      owner: "",
      participants: [],
      startDate: "2026-09-04",
      endDate: "2026-09-07",
      milestoneId: "m1",
      subtasks: [],
    },
  ],
  openObstacles: [],
  decisions: [],
  economy: null,
};

function input(context: ChatContext, previousTips: string[] = []): TipInput {
  return {
    context,
    recentActivity: [],
    statusHistory: [],
    daysSinceLastStatus: 2,
    previousTips,
    observations: [],
  };
}

describe("the daily tip", () => {
  it("puts an overdue task first and suggests something to do about it", async () => {
    const tip = await rulesEngine.dailyTip(input(base));
    expect(tip.title).toContain("over deadline");
    expect(tip.action).toContain("Skriv program");
  });

  it("skips a tip already given and finds the next one", async () => {
    const tip = await rulesEngine.dailyTip(input(base, ["Én opgave er over deadline"]));
    expect(tip.title).toContain("Program klar");
  });

  it("says the plan looks healthy when nothing sticks out", async () => {
    const calm: ChatContext = {
      ...base,
      milestones: [],
      tasks: [
        {
          ...base.tasks[1]!,
          owner: "Mette",
          startDate: "2026-09-20",
          endDate: "2026-09-25",
          milestoneId: null,
        },
      ],
    };
    const tip = await rulesEngine.dailyTip(input(calm));
    expect(tip.title).toBe("Planen ser sund ud");
  });

  it("reads the same plan in English", async () => {
    const tip = await rulesEngine.dailyTip(input({ ...base, locale: "en" }));
    expect(tip.title.toLowerCase()).toContain("overdue");
  });
});

describe("observations", () => {
  it("orders what it finds by how much it matters", () => {
    const obs = observeProject(base, 2);
    expect(obs.length).toBeGreaterThan(0);
    const severities = obs.map((o) => o.severity);
    expect([...severities].sort((a, b) => b - a)).toEqual(severities);
  });

  it("repeats the most important observation rather than saying nothing", () => {
    const obs = observeProject(base, 2);
    const tip = fallbackTip(
      obs,
      obs.map((o) => o.tip.title),
      "da",
    );
    expect(tip.title).toBe(obs[0]!.tip.title);
  });

  it("says the plan is healthy when there is nothing to observe", () => {
    expect(fallbackTip([], [], "da").title).toBe("Planen ser sund ud");
    expect(fallbackTip([], [], "en").title).toBe("The plan looks healthy");
  });
});
