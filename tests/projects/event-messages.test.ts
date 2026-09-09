import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import da from "../../messages/da.json";
import en from "../../messages/en.json";
import { renderEvent } from "@/modules/projects/events";

/**
 * Every event the code records must render into a sentence in both
 * languages with the payload the code actually writes. A message that
 * names a variable the payload lacks renders as the raw type name in the
 * history and the AI's activity — which happened once with task.moved.
 * The payloads here mirror the recordEvent calls in src/modules.
 */
const RECORDED: Array<[string, Record<string, unknown>]> = [
  ["project.created", { name: "P" }],
  ["task.created", { title: "T", start: "2026-09-01", end: "2026-09-05" }],
  ["task.state", { title: "T", state: "doing" }],
  ["task.moved", { title: "T", start: "2026-09-01", end: "2026-09-05" }],
  ["task.relinked", { title: "T", milestone: "M" }],
  ["task.people", { title: "T", owner: "Mette", participants: ["Jonas"] }],
  ["task.subtasks", { title: "T", count: 3 }],
  ["task.deleted", { title: "T" }],
  ["milestone.created", { title: "M", date: "2026-10-01" }],
  ["milestone.updated", { title: "M" }],
  ["milestone.done", { title: "M" }],
  ["milestone.reopened", { title: "M" }],
  ["milestone.deleted", { title: "M" }],
  ["decision.added", { title: "D" }],
  ["obstacle.added", { title: "O" }],
  ["obstacle.resolved", { title: "O" }],
  ["budget.set", { amount: 1000 }],
  ["expense.added", { title: "E", amount: 100, spent: 0 }],
  ["expense.toggled", { title: "E", amount: 100, spent: 100 }],
  ["expense.removed", { title: "E", amount: 100 }],
  ["roles.set", { owner: "A", manager: "B" }],
  ["status.approved", { week: "2026-W37", rag: "green" }],
  ["replan.applied", { milestone: "M", date: "2026-10-08", moved: 3 }],
  ["snapshot.created", { label: "L" }],
  ["snapshot.restored", { label: "L" }],
  ["ai.applied", { count: 2 }],
  ["reply.state", { by: "Mette", title: "T", state: "done" }],
  ["reply.note", { by: "Mette", task: "T", text: "Alt vel" }],
  ["reply.answer", { by: "Mette", question: "Q?", text: "Ja" }],
];

describe("event messages", () => {
  for (const [locale, messages] of [
    ["da", da],
    ["en", en],
  ] as const) {
    it(`render every recorded event in ${locale}`, () => {
      const t = createTranslator({
        locale,
        messages: messages as unknown as Record<string, unknown>,
        namespace: "events",
        onError: (error) => {
          throw error;
        },
      });
      const translate = (key: string, values?: Record<string, string | number | Date>) =>
        t(key as never, values as never);
      for (const [type, payload] of RECORDED) {
        const line = renderEvent(translate, { type, payload });
        expect(line, type).not.toBe(type);
        expect(line, type).not.toMatch(/\{[a-z]+\}/i);
      }
    });
  }
});
