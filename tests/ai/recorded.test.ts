import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contextFor, detectIntents, schemaFor } from "@/modules/ai/intents";
import { parseModelJson } from "@/modules/ai/parse-json";
import { sanitizeChatReply } from "@/modules/ai/sanitize";
import { chatReplyHasChanges, type ChatContext, type ChatReply } from "@/modules/ai/types";

/**
 * Replies real models have given, run through the same parse and
 * sanitize steps the engine uses. Each file says what has to come out.
 * See tests/ai/recorded/README.md for how to add one.
 */

const dir = join(__dirname, "recorded");
const context = JSON.parse(readFileSync(join(dir, "project.json"), "utf8")) as ChatContext;

type Recorded = {
  model: string;
  message: string;
  raw: string;
  expect: Partial<Record<keyof ChatReply, unknown>> & { changes: boolean; note?: string };
};

const files = readdirSync(join(dir, "replies")).filter((f) => f.endsWith(".json"));

describe("recorded model replies", () => {
  for (const file of files) {
    const recorded = JSON.parse(readFileSync(join(dir, "replies", file), "utf8")) as Recorded;
    it(`${file}: ${recorded.message}`, () => {
      const parsed = parseModelJson(recorded.raw);
      const reply = sanitizeChatReply(parsed, context);
      const { changes, note: _note, ...fields } = recorded.expect;
      void _note;
      if (reply === null) {
        expect(changes, "a reply the sanitizer refuses cannot carry changes").toBe(false);
        return;
      }
      expect(chatReplyHasChanges(reply)).toBe(changes);
      for (const [field, wanted] of Object.entries(fields)) {
        const got = reply[field as keyof ChatReply];
        if (Array.isArray(wanted)) {
          expect(got, field).toHaveLength(wanted.length);
          wanted.forEach((item, i) =>
            expect((got as unknown[])[i], `${field}[${i}]`).toMatchObject(item as object),
          );
        } else expect(got, field).toEqual(wanted);
      }
    });
  }
});

describe("the schema is cut to what the message is about", () => {
  it("gives a plain move only the plan fields", () => {
    const intents = detectIntents("Skub Byg tilmeldingsside en uge", "da");
    expect(intents).toEqual(["plan"]);
    const schema = schemaFor(intents);
    expect(schema).toContain("taskMoves");
    expect(schema).not.toContain("budgetChange");
    expect(schema).not.toContain("newObstacles");
  });

  it("adds the money and the obstacles when the words point at them", () => {
    expect(detectIntents("Sæt budgettet til 80.000 kr.", "da")).toEqual(["plan", "money"]);
    expect(detectIntents("Notér en forhindring: lokalet er optaget", "da")).toEqual(
      expect.arrayContaining(["plan", "obstacles", "decisions"]),
    );
    expect(detectIntents("Who owns the signup page?", "en")).toEqual(["plan", "people"]);
  });

  it("matches a cue only at the start of a word", () => {
    // "skriv" contains "kr"; it is not about money.
    expect(detectIntents("Skriv en opgave om at kryds af", "da")).not.toContain("money");
    expect(detectIntents("Det koster 5.000 kr", "da")).toContain("money");
  });

  it("gives everything when the message points at nothing in particular", () => {
    expect(detectIntents("Er planen realistisk?", "da")).toHaveLength(8);
    expect(schemaFor(detectIntents("Hvad synes du?", "da"))).toContain("roleChanges");
  });

  it("trims the context to match, and never the plan", () => {
    const cut = contextFor(context, ["plan"]);
    expect(cut.economy).toBeNull();
    expect(cut.openObstacles).toEqual([]);
    expect(cut.tasks).toHaveLength(context.tasks.length);
    const money = contextFor(context, ["plan", "money"]);
    expect(money.economy?.budget).toBe(60000);
  });
});

describe("parsing what a model wrote", () => {
  it("strips a fence and a sentence before the object", () => {
    expect(parseModelJson('```json\n{"reply":"Hej"}\n```')).toEqual({ reply: "Hej" });
    expect(parseModelJson('Her er svaret: {"reply":"Hej"}')).toEqual({ reply: "Hej" });
    expect(parseModelJson("Beklager, det kan jeg ikke.")).toBeNull();
  });
});
