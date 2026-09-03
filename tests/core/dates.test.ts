import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  diffDays,
  formatDateDa,
  maxIso,
  minIso,
  mondayOf,
  todayInCopenhagen,
  weekKey,
  weekNumber,
  weekNumberFromKey,
  weekYear,
} from "@/core/dates";

/**
 * Dates are plain ISO strings everywhere in Ajour, computed in
 * Europe/Copenhagen. A plan that reads "flyttet til fredag" must mean the
 * same Friday on a server in another timezone.
 */

describe("date arithmetic", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDaysIso("2026-09-01", 1)).toBe("2026-09-02");
    expect(addDaysIso("2026-09-29", 3)).toBe("2026-10-02");
    expect(addDaysIso("2026-09-01", -1)).toBe("2026-08-31");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("counts the difference in days, in both directions", () => {
    expect(diffDays("2026-09-01", "2026-09-08")).toBe(7);
    expect(diffDays("2026-09-08", "2026-09-01")).toBe(-7);
    expect(diffDays("2026-09-01", "2026-09-01")).toBe(0);
  });

  it("is not thrown by the change to summer time", () => {
    expect(addDaysIso("2026-03-28", 1)).toBe("2026-03-29");
    expect(diffDays("2026-03-28", "2026-03-30")).toBe(2);
    expect(addDaysIso("2026-10-24", 2)).toBe("2026-10-26");
  });

  it("finds the Monday of a week", () => {
    expect(mondayOf("2026-09-01")).toBe("2026-08-31"); // Tuesday
    expect(mondayOf("2026-08-31")).toBe("2026-08-31"); // Monday itself
    expect(mondayOf("2026-09-06")).toBe("2026-08-31"); // Sunday belongs to its week
  });

  it("finds the smallest and largest date", () => {
    expect(minIso(["2026-09-10", "2026-09-01", "2026-10-01"])).toBe("2026-09-01");
    expect(maxIso(["2026-09-10", "2026-09-01", "2026-10-01"])).toBe("2026-10-01");
  });
});

describe("ISO week numbers", () => {
  it("counts weeks the way a Danish calendar does", () => {
    expect(weekNumber("2026-09-01")).toBe(36);
    expect(weekNumber("2026-01-01")).toBe(1);
    expect(weekNumber("2026-12-31")).toBe(53);
  });

  it("puts a week that straddles new year in the year that owns it", () => {
    expect(weekYear("2027-01-01")).toBe(2026);
    expect(weekKey("2027-01-01")).toBe("2026-W53");
    expect(weekKey("2026-09-01")).toBe("2026-W36");
    expect(weekNumberFromKey("2026-W36")).toBe(36);
  });
});

describe("today", () => {
  it("is read in Copenhagen, not in UTC", () => {
    // 23:30 UTC on the last day of August is already September in Copenhagen.
    expect(todayInCopenhagen(new Date("2026-08-31T23:30:00Z"))).toBe("2026-09-01");
    expect(todayInCopenhagen(new Date("2026-09-01T10:00:00Z"))).toBe("2026-09-01");
  });
});

describe("readable dates", () => {
  it("writes a Danish date without leading zeroes", () => {
    expect(formatDateDa("2026-09-01")).toContain("1.");
    expect(formatDateDa("2026-09-01")).toContain("2026");
  });
});
