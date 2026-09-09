import { describe, expect, it } from "vitest";
import { sharedTextWarning } from "@/modules/reports/shared-text";
import type { StatusReport } from "@/modules/reports/status-report";

/**
 * The share link withholds the budget and the obstacle list, and then the
 * summary says both out loud because that is what the engine writes. The
 * cut is real; the promise around it was not the whole truth. This is the
 * check that tells the manager, while they can still edit the words.
 */

const kr = (n: number) => `${n.toLocaleString("da-DK")} kr.`;

function reportWith(over: Partial<StatusReport>): StatusReport {
  return {
    version: 2,
    today: "2026-09-09",
    weekKey: "2026-W37",
    projectName: "Forårskonference",
    goal: "",
    ownerName: "",
    managerName: "",
    approvedByName: "",
    rag: "green",
    ragSuggested: null,
    ragReason: "",
    text: "",
    managerComment: "",
    managementAsks: [],
    nextWeek: [],
    sinceLast: [],
    trend: [],
    progress: { done: 0, total: 0 },
    economy: null,
    expenses: [],
    milestones: [],
    tasks: [],
    obstacles: [],
    decisions: [],
    decisionsSince: null,
    engine: "rules",
    ...over,
  };
}

const withMoney = reportWith({
  economy: { budget: 60000, plannedTotal: 45000, incurredTotal: 15000, postCount: 3 },
  obstacles: [{ title: "Det store lokale er muligvis optaget i uge 43", since: "2026-09-01" }],
});

describe("sharedTextWarning", () => {
  it("says nothing about a summary that keeps the money to itself", () => {
    expect(
      sharedTextWarning("Tre opgaver er færdige. Næste milepæl er om 18 dage.", withMoney, kr),
    ).toBeNull();
  });

  it("names the figures the summary quotes", () => {
    const found = sharedTextWarning(
      "Økonomi: 45.000 kr. er registreret af budgettet på 60.000 kr.",
      withMoney,
      kr,
    );
    expect(found?.money).toContain("45.000 kr.");
    expect(found?.money).toContain("60.000 kr.");
  });

  it("catches an amount the model reworded rather than quoted", () => {
    // The exact figure is not in the text; the budget still is.
    const found = sharedTextWarning("Vi ligger omkring 44.500 kr. lige nu.", withMoney, kr);
    expect(found?.money.length).toBeGreaterThan(0);
  });

  it("names an obstacle the summary repeats", () => {
    const found = sharedTextWarning(
      "Åbne forhindringer: Det store lokale er muligvis optaget i uge 43.",
      withMoney,
      kr,
    );
    expect(found?.obstacles).toEqual(["Det store lokale er muligvis optaget i uge 43"]);
  });

  it("has nothing to say when the report has no money and no obstacles", () => {
    expect(sharedTextWarning("60.000 kr. et eller andet.", reportWith({}), kr)).toBeNull();
  });
});
