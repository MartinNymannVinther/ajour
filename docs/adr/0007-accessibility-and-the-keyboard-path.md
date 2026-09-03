# ADR 0007: Accessibility, the keyboard path, and two greys

Status: accepted · Date: 2026-09-03

Wave three's job was to make good on a promise the product vision makes
in one line: an update must be doable on a phone in under a minute. A
phone has no drag, a screen reader has no pointer, and a person reading
in daylight has no patience for grey on grey. This records what that
cost.

## Every core action has a keyboard path, not a keyboard workaround

The timeline is the only part of Ajour where a mouse could have been the
only way in. It is not: a focused task bar moves a day with the arrow
keys, resizes with shift and an arrow, changes milestone with alt and an
arrow, and opens with enter. A focused milestone diamond moves with the
arrows and proposes the same replan a drag would.

That is the same operation reaching the same service, not a reduced
version of it. `keyboard.mjs` in the verification run drives the plan with
no pointer at all and checks the database moved.

The board is the second answer: every card carries a state select, so
changing what a task is doing never requires a drag on any device.

## Two greys darker than the 2a handoff

At the handoff's values `--meta` reads 4.13:1 and `--label` 2.83:1 on the
card surface. Both are used for 11-14px text, where WCAG AA asks 4.5:1.
Ajour darkens them to 5.19:1 and 4.60:1 on the worst surface they land
on, and lifts the dark-mode pair to match. The hue and the gap between
the two are kept, so the page still reads as 2a.

Trade-off accepted: Ajour's greys are no longer the family's greys to the
digit. The alternative was shipping text that a good number of people
cannot read, which no design system is worth. This is worth taking back
to Haij rather than keeping as a local patch.

## A 24px floor on anything you can hit

Every focusable control is at least 24 by 24 CSS pixels, which is WCAG
2.2's target-size minimum. The milestone diamond keeps its 16px look and
gets a 28px hit area; inline text buttons and checkboxes were raised.

## What a failed write does

Nothing a person typed is thrown away because a write failed. Every form
clears itself only when the action reports success, and a conflict — a
row somebody else changed while this one was being typed — says so in
words and reloads the page, rather than either overwriting them or
pretending nothing happened.

## The public endpoint is rate limited, in memory, on purpose

The share page counts reads per address, sixty a minute, in process. A
token is 144 random bits so guessing is not the threat; a script is. The
limiter is deliberately not a shared store: Ajour is one container, so a
shared store would be a dependency bought for nothing. The honest cost is
written into `src/core/rate-limit.ts` — counters reset on restart, and an
installation scaled to several instances gets a limit per instance.

## The AI's writes are scoped to the project, twice

A defect found by writing the test rather than by reading the code: the
sanitizer drops ids the project's context did not contain, but the write
layer looked rows up by id within the workspace, so a reply naming a task
in a sibling project would have moved it. `applyChatReply` now reads the
project's own ids first and skips anything outside them. The sanitizer
remains the first line; it is no longer the only one.
