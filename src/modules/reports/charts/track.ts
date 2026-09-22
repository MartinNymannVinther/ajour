import { diffDays, formatDateDa } from "@/core/dates";
import type { StatusReport } from "../status-report";
import { INK, RAG_COLOR, type Figure, type Shape } from "./types";

export type TrackWords = { start: string; daysTo: (days: number) => string };

const TITLE_SIZE = 7.5;
const DATE_SIZE = 7.2;
const LINE_H = 9.5;
/** Archivo's average advance per character, in em, with a margin for wide words. */
const CHAR_EM = 0.56;
/** Air between two neighbouring labels in the same row. */
const PAD = 3;
const LABEL_TOP = 32;

type TrackPoint = { title: string; date: string | null; done: boolean };

/** The milestones as one line, the reached part filled, the next one ringed in the assessment's colour. */
export function milestoneTrackFigure(
  report: StatusReport,
  width: number,
  words: TrackWords,
): Figure {
  const shapes: Shape[] = [];
  const left = 10;
  const right = width - 10;
  const points: TrackPoint[] = [
    { title: words.start, date: null, done: true },
    ...report.milestones.map((m) => ({
      title: m.title,
      date: m.date as string | null,
      done: m.done,
    })),
  ];
  const n = points.length;
  const gap = n > 1 ? (right - left) / (n - 1) : 0;
  const nextIndex = points.findIndex((p, i) => i > 0 && !p.done);
  // Five points in a card's width leave no room for five labels in one
  // row; every other label steps down a row instead of into its neighbour.
  const stagger = gap < 64;
  const reachedUntil = nextIndex === -1 ? n - 1 : nextIndex - 1;
  const rag = report.rag ?? "early";
  const labels = layoutLabels(points, {
    left,
    gap,
    width,
    stagger,
    nextIndex,
    today: report.today,
  });
  const rowTop = [LABEL_TOP, LABEL_TOP + labels.rowHeight[0]! + 6];
  const lastRow = labels.rowHeight.length - 1;
  const height = rowTop[lastRow]! + labels.rowHeight[lastRow]! + 2;

  shapes.push({ kind: "line", x1: left, y1: 14, x2: right, y2: 14, stroke: INK.paper, width: 3 });
  if (reachedUntil > 0) {
    shapes.push({
      kind: "line",
      x1: left,
      y1: 14,
      x2: left + gap * reachedUntil,
      y2: 14,
      stroke: INK.primary,
      width: 3,
    });
  }
  points.forEach((p, i) => {
    const px = left + gap * i;
    if (i === 0) {
      shapes.push({ kind: "circle", cx: px, cy: 14, r: 4, fill: INK.primary });
    } else {
      const isNext = i === nextIndex;
      shapes.push({
        kind: "polygon",
        points: [
          [px, 8],
          [px + 6, 14],
          [px, 20],
          [px - 6, 14],
        ],
        fill: p.done ? INK.primary : INK.card,
        stroke: p.done ? INK.primary : isNext ? RAG_COLOR[rag].dot : INK.sand,
        strokeWidth: 2,
      });
    }
    const label = labels.items[i]!;
    const top = rowTop[label.row]!;
    if (label.row === 1) {
      shapes.push({
        kind: "line",
        x1: px,
        y1: 21,
        x2: px,
        y2: top - 9,
        stroke: INK.hairline,
        width: 1,
      });
    }
    label.lines.forEach((line, li) =>
      shapes.push({
        kind: "text",
        x: label.x,
        y: top + li * LINE_H,
        text: line,
        size: TITLE_SIZE,
        fill: INK.fg,
        weight: 600,
        anchor: label.anchor,
      }),
    );
    if (p.date) {
      const dateY = top + label.lines.length * LINE_H + 1;
      shapes.push({
        kind: "text",
        x: label.x,
        y: dateY,
        text: formatDateDa(p.date),
        size: DATE_SIZE,
        fill: i === nextIndex ? INK.fg : INK.meta,
        anchor: label.anchor,
      });
      // "in N days" on its own line: beside the date it collides with the
      // neighbour's date as soon as the card is narrow.
      if (label.daysTo !== null) {
        shapes.push({
          kind: "text",
          x: label.x,
          y: dateY + 9,
          text: words.daysTo(label.daysTo),
          size: DATE_SIZE,
          fill: INK.fg,
          weight: 600,
          anchor: label.anchor,
        });
      }
    }
  });
  return { width, height, shapes };
}

type PlacedLabel = {
  row: number;
  x: number;
  anchor: "start" | "middle" | "end";
  lines: string[];
  daysTo: number | null;
};

/**
 * Every label gets a box of its own: from the midpoint to the previous
 * label in the same row to the midpoint to the next one, and no further
 * than the figure's edge. The title wraps inside the box and is cut when
 * two lines are not enough, and the anchor follows the box rather than
 * the point, so the label at either end never reaches past its
 * neighbour. The lower row starts where the upper one actually ends.
 */
function layoutLabels(
  points: TrackPoint[],
  o: {
    left: number;
    gap: number;
    width: number;
    stagger: boolean;
    nextIndex: number;
    today: string;
  },
): { items: PlacedLabel[]; rowHeight: number[] } {
  const rows = o.stagger ? 2 : 1;
  const step = o.gap * rows;
  const rowHeight = new Array<number>(rows).fill(0);
  const items = points.map((p, i): PlacedLabel => {
    const px = o.left + o.gap * i;
    const row = o.stagger ? i % 2 : 0;
    const boxLeft = i - rows >= 0 ? px - step / 2 + PAD : 2;
    const boxRight = i + rows < points.length ? px + step / 2 - PAD : o.width - 2;
    const maxChars = Math.max(6, Math.floor((boxRight - boxLeft) / (TITLE_SIZE * CHAR_EM)));
    const lines = wrapTitle(p.title, maxChars);
    const days = p.date ? diffDays(o.today, p.date) : -1;
    const daysTo = i === o.nextIndex && days >= 0 ? days : null;
    // The date is often wider than a short title; the anchor must hold for both.
    const widest = Math.max(
      ...lines.map((l) => l.length * TITLE_SIZE * CHAR_EM),
      p.date ? 10 * DATE_SIZE * CHAR_EM : 0,
    );
    const anchor =
      px - widest / 2 < boxLeft ? "start" : px + widest / 2 > boxRight ? "end" : "middle";
    const x = anchor === "start" ? boxLeft : anchor === "end" ? boxRight : px;
    const height = lines.length * LINE_H + (p.date ? LINE_H : 0) + (daysTo !== null ? 9 : 0);
    rowHeight[row] = Math.max(rowHeight[row]!, height);
    return { row, x, anchor, lines, daysTo };
  });
  return { items, rowHeight };
}

/** One word wider than the box is cut too; a single long word must not reach the neighbour. */
const cut = (maxChars: number) => (line: string) =>
  line.length > maxChars ? line.slice(0, maxChars - 1) + "…" : line;

function wrapTitle(title: string, maxChars: number): string[] {
  if (title.length <= maxChars) return [title];
  const words = title.split(" ");
  const first: string[] = [];
  while (words.length > 0 && `${first.join(" ")} ${words[0]}`.trim().length <= maxChars) {
    first.push(words.shift()!);
  }
  if (first.length === 0) first.push(words.shift()!);
  const rest = words.join(" ");
  return [first.join(" "), rest].filter(Boolean).map(cut(maxChars));
}
