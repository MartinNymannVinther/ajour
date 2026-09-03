import { describe, expect, it } from "vitest";
import { addDaysIso } from "@/core/dates";
import { buildTemplate, findTemplate, PROJECT_TEMPLATES } from "@/modules/projects/templates";

/**
 * The templates are the fast path into the Start flow: a person who does
 * not want to describe anything picks one and has a plan. They must
 * therefore produce a plan that is valid without a model ever running.
 */

const today = "2026-09-01";

describe("project templates", () => {
  it("has five templates with unique ids, in both languages", () => {
    expect(PROJECT_TEMPLATES).toHaveLength(5);
    expect(new Set(PROJECT_TEMPLATES.map((t) => t.id)).size).toBe(5);
    for (const t of PROJECT_TEMPLATES) {
      expect(t.name.da.length).toBeGreaterThan(2);
      expect(t.name.en.length).toBeGreaterThan(2);
      expect(t.tagline.da).not.toBe(t.tagline.en);
    }
  });

  it("is found by id, and unknown ids give nothing", () => {
    expect(findTemplate("event")?.id).toBe("event");
    expect(findTemplate("findes-ikke")).toBeUndefined();
  });

  it("builds valid plans with dates counted from today", () => {
    for (const tpl of PROJECT_TEMPLATES) {
      const p = buildTemplate(tpl, today, "da");
      expect(p.name.length).toBeGreaterThan(2);
      expect(p.milestones.length).toBeGreaterThanOrEqual(3);
      expect(p.tasks.length).toBeGreaterThanOrEqual(5);
      for (const m of p.milestones) {
        expect(m.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(m.date > today).toBe(true);
      }
      for (const t of p.tasks) {
        expect(t.startDate <= t.endDate).toBe(true);
        expect(t.milestoneIndex).not.toBeNull();
        expect(t.milestoneIndex!).toBeLessThan(p.milestones.length);
      }
    }
  });

  it("keeps tasks in reasonable reach of their milestone", () => {
    for (const tpl of PROJECT_TEMPLATES) {
      const p = buildTemplate(tpl, today, "da");
      for (const t of p.tasks) {
        const m = p.milestones[t.milestoneIndex!]!;
        expect(t.endDate <= addDaysIso(m.date, 21)).toBe(true);
      }
    }
  });

  it("builds the same shape in English with English words", () => {
    const da = buildTemplate(PROJECT_TEMPLATES[0]!, today, "da");
    const en = buildTemplate(PROJECT_TEMPLATES[0]!, today, "en");
    expect(en.milestones.map((m) => m.date)).toEqual(da.milestones.map((m) => m.date));
    expect(en.name).not.toBe(da.name);
  });
});
