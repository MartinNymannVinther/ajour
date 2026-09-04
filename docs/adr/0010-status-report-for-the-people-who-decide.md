# ADR 0010: The status report, for the people who decide

Status: accepted · Date: 2026-09-04

The weekly status was a few sentences and a plain PDF of lists. Honest,
and not something a steering group reads. Project managers know this,
which is why status reporting is the work they resent most: hours spent
on a document that answers no question anyone in the room has.

The status is now a two-page report. The front page is for the people
who decide: an overall assessment with its reason, what management is
asked to do, the manager's own words, the numbers as figures, what
changed since last week, and only the part of the plan that carries the
next milestones. The appendix is for the people who ask: the whole
timeline, every task, the decisions and the money lines. The front page
can be read alone, and it says so.

## The colour is derived, and a person can overrule it

The assessment — green, yellow, red, or "new" for a plan too young to
judge — is computed from the plan by `src/modules/reports/assessment.ts`:
is the next milestone at risk, is anything late, is anything in the way,
is the money running ahead of the work. The worst answer sets the colour
and the reasons name it. A language model may write the sentences around
it; it never picks the colour. A steering group acts on that colour, and
it should not depend on which model was awake that morning.

The manager can change it. When they do, the report shows both: what the
engine proposed and what the manager chose. That is not a weakness to
hide. A manager who says "the numbers say yellow, I say red, and here is
why" is exactly what a steering group needs to hear.

## The editor is a rule, not a taste

Which sections appear is decided by `src/modules/reports/sections.ts`,
the same way every week: money only when there is a budget or a line,
obstacles only when one is open, decisions only since the last status,
and on the front page only the tasks under the next two milestones that
are still moving. A section that is missing is missing because there was
nothing in it, and a reader learns to trust that. This is the
"intelligence about how much to include" asked for, done deterministically
so that it is the same intelligence on an installation with no model.

## What management is asked to do carries over

Each status holds a list of asks: a decision, a resource, an obstacle
only management can clear, each with a date it needs an answer by. An
ask left unanswered is carried into next week's draft, marked with the
week it was first raised, until the manager marks it answered. Then it
shows once more as answered and retires. The list makes visible what a
status otherwise hides: the weeks in which the project waited for the
people it reports to.

## Since last, and the trend, are worked out, not remembered

"Since last" is condensed from the event log between two approvals:
milestones reached, tasks finished, obstacles opened and closed, the
plan moved, decisions taken. The manager never has to recall the week.
The trend is the assessment of the last five statuses as dots in the
header, because three greens and two yellows say more than one yellow.

## One geometry, two renderers

Every figure — the plan as bars, the milestones as a line, the money and
the progress as bars — is computed once as plain geometry in
`src/modules/reports/charts/` and drawn twice: as inline SVG on the
status page, where it updates as the manager types, and with react-pdf's
SVG primitives in the PDF. The preview and the document cannot disagree
about where a bar ends because they never had two opinions.

The PDF is set in Archivo, the family's face, shipped in `public/fonts`
under its own OFL licence. No figure is ever split by a page edge: each
sits in a view that moves whole to the next page when it does not fit,
and the appendix grows to a third page rather than cutting a chart in
two.

## Trade-offs accepted

The report freezes rendered sentences for "since last" and the reasons,
in the language of the person who approved it. A reader in the other
language sees those sentences as written, while the labels around them
follow the reader. Freezing structured events instead would have kept
the text translatable at the cost of a second event vocabulary in the
report; the sentences are the honest record of what was approved.

The demo project is created fresh on each visit, so its first status is
"new" by the assessment's own rule. That is correct and dull. A demo
that showed the report at its best would need a seeded history, which is
a separate decision.

Breaking a milestone into tasks (`src/modules/projects/breakdown.ts`)
follows the same shape as everything else the AI does here: the engine
proposes, the person edits and ticks, a snapshot is taken, then rows are
written. Without a model the rules borrow the tasks of a template
milestone that sounds like this one, or fall back to the four moves every
milestone takes.
