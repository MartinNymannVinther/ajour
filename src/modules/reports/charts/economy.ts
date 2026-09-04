import type { StatusReport } from "../status-report";
import { INK, type Figure, type Shape } from "./types";

export type EconomyWords = {
  spend: string;
  ofBudget: (incurred: string, budget: string) => string;
  breakdown: (spent: number, planned: number) => string;
  noBudget: (incurred: string, planned: string) => string;
  progress: string;
  ofTasks: (done: number, total: number) => string;
  ahead: (points: number) => string;
  money: (n: number) => string;
};

/** Spend against budget and work done, as two bars one above the other. */
export function economyFigure(report: StatusReport, width: number, words: EconomyWords): Figure {
  const shapes: Shape[] = [];
  const e = report.economy;
  const height = 84;
  const barW = width;
  if (e) {
    const scale = e.budget ?? Math.max(e.plannedTotal, e.incurredTotal, 1);
    const pct = (n: number) => Math.min(1, n / scale);
    shapes.push({ kind: "text", x: 0, y: 9, text: words.spend, size: 8, fill: INK.label });
    shapes.push({
      kind: "text",
      x: barW,
      y: 9,
      text:
        e.budget !== null
          ? words.ofBudget(words.money(e.incurredTotal), words.money(e.budget))
          : words.noBudget(words.money(e.incurredTotal), words.money(e.plannedTotal)),
      size: 8.5,
      fill: INK.fg,
      weight: 600,
      anchor: "end",
    });
    shapes.push({ kind: "rect", x: 0, y: 14, w: barW, h: 9, rx: 4.5, fill: INK.paper });
    shapes.push({
      kind: "rect",
      x: 0,
      y: 14,
      w: barW * pct(e.plannedTotal),
      h: 9,
      rx: 4.5,
      fill: INK.sand,
    });
    shapes.push({
      kind: "rect",
      x: 0,
      y: 14,
      w: barW * pct(e.incurredTotal),
      h: 9,
      rx: 4.5,
      fill: e.budget !== null && e.plannedTotal > e.budget ? INK.warn : INK.primary,
    });
    if (e.budget) {
      shapes.push({
        kind: "text",
        x: 0,
        y: 33,
        text: words.breakdown(
          Math.round((e.incurredTotal / e.budget) * 100),
          Math.round((e.plannedTotal / e.budget) * 100),
        ),
        size: 7.2,
        fill: INK.meta,
      });
    }
  }
  const { done, total } = report.progress;
  const workPct = total > 0 ? done / total : 0;
  shapes.push({ kind: "text", x: 0, y: 52, text: words.progress, size: 8, fill: INK.label });
  shapes.push({
    kind: "text",
    x: barW,
    y: 52,
    text: words.ofTasks(done, total),
    size: 8.5,
    fill: INK.fg,
    weight: 600,
    anchor: "end",
  });
  shapes.push({ kind: "rect", x: 0, y: 56, w: barW, h: 9, rx: 4.5, fill: INK.paper });
  shapes.push({ kind: "rect", x: 0, y: 56, w: barW * workPct, h: 9, rx: 4.5, fill: INK.soft });
  if (e?.budget) {
    const points = Math.round((e.incurredTotal / e.budget) * 100) - Math.round(workPct * 100);
    if (points >= 15)
      shapes.push({
        kind: "text",
        x: 0,
        y: 76,
        text: words.ahead(points),
        size: 7.2,
        fill: INK.warn,
        weight: 600,
      });
  }
  return { width, height, shapes };
}
