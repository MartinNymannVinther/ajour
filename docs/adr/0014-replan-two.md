# ADR 0014: Replanning, second version

Status: accepted · Date: 2026-09-09

## What the first version did

Drag a milestone and the rules engine moved its open tasks the same
distance and, when the move was later, pushed every later milestone by
the same amount. It was predictable, which is the point of a replan a
person triggers by hand, and it had three blind spots: the pushed
milestones' own tasks stayed where they were and ended after their
milestone; a date that cannot move — the conference is on the 15th —
was pushed like any other; and nobody could see what the proposal had
chosen not to touch, or whether the result gave one person three tasks
in the same week.

## The decision

The arithmetic lives in `modules/ai/replan.ts` and is still
deterministic; the model, when there is one, only writes the summary.

- A pushed milestone takes its open tasks with it.
- A milestone can be marked **fixed** (a checkbox in its editor, a badge
  in the list). A replan never moves a fixed milestone; it holds it and
  says so. Dragging a fixed milestone by hand still works — the person is
  the one moving it.
- The proposal lists what it **keeps** and why: a finished task, a fixed
  milestone, a later milestone on a move forward, or every later
  milestone when the person switched the ripple off.
- The ripple is a choice on the banner: "push later milestones too", on
  by default when the move is later. Switching it off asks for a new
  proposal and shows the difference before anything is applied.
- Every owner's open tasks are checked as they would be after the move;
  three or more on the same day is an **overload** the banner names with
  the person, the count and the days.

## Trade-offs accepted

The overload threshold is a constant (three), not a per-person capacity;
capacity planning is on the list of things the product deliberately does
not do. A fixed milestone that the move runs into is held, not resolved:
the proposal shows the collision and the person decides, which is the
whole design of Skred — the tool computes, the human chooses.
