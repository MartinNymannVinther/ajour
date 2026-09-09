# ADR 0012: Chat prompts cut by intent, and recorded replies as tests

Status: accepted · Date: 2026-09-09

## The problem

The chat may act on the whole project: sixteen action fields, from moving
a task to renaming the project manager. A hosted model handles that
schema; a 12B model running on a laptop through Ollama does not reliably.
Handed every field on every message, it fills in fields nobody asked for
— a duplicate obstacle next to the budget it was asked to set, a checklist
rewritten on the way past — and the sanitizer, which only knows ids and
shapes, lets a well-formed mistake through.

## The decision

The message is read for what it is about before the model sees it
(`modules/ai/intents.ts`). Cues in both languages map the words to eight
intents; the model gets the plan fields always, plus the fields the
message points at, and the context is trimmed to match: no money when
the message is not about money, no obstacles when it is not about
obstacles. A message that points at nothing in particular gets the whole
schema, as before, so the cut is an optimisation and never a refusal.
The prompt tells the model that a request outside the listed fields is
answered with a question, not an improvised field.

Real model replies are kept verbatim under `tests/ai/recorded/`, each
with what the sanitizer must make of it, and run on every test run. The
parse step the engine uses (`parse-json.ts`) is the one the test uses, so
a fence, a sentence before the object or a control character in a title
is caught where it happened once and never again.

The wait is shown: a counter next to the "thinking" line and, past twenty
seconds, a sentence saying a local model takes that long and that the
rules engine takes over if it does not answer.

## Trade-offs accepted

A cue list is a heuristic. A message phrased around a word the list does
not know gets the full schema, which is today's behaviour; a message
phrased around a word that belongs to another intent gets a narrower
schema than it needed and the model asks for it in one sentence. Both
are cheaper than a model that acts on what it was not asked. The list
lives in one file and grows from recorded replies, not from guesses.
