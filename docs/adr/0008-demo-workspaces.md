# ADR 0008: A demo workspace per visitor

Status: accepted · Date: 2026-09-03

A closed installation has a front door that says "apply". That is right
for an organisation's Ajour and wrong for somebody deciding whether Ajour
is worth applying for. Screenshots do not answer the question a project
tool raises, which is what it feels like to change a plan.

So: `/demo` builds a workspace, seeds a project, signs the visitor in and
sends them to it.

## It is the product, not a demonstration of it

The demo workspace is an ordinary workspace. Same tables, same policies,
same services, same audit trail. The seed builds its project by calling
the same functions the interface calls, so a demo cannot quietly drift
away from what a customer would get, and a bug in the product is a bug in
the demo where somebody will notice it.

The account is created through the ordinary sign-up path rather than by
writing rows, so a demo session is a session: every guard, every
redirect and every permission behaves the way it will for a real user.

## The project it lands in is half-finished on purpose

One task running and behind, an open obstacle, a decision already taken,
money partly spent, three milestones with acceptance criteria. A plan
where everything is fine demonstrates nothing: the tool exists for the
moment a plan starts to slip, so the demo starts there.

## It disappears, and the cleanup does not need a scheduler

A `demo_workspaces` row names the workspace, the throwaway user and the
hour it stops existing — 24 hours. Cleanup runs on every visit, so an
installation with visitors needs nothing else; `scripts/cleanup-demos.ts`
and `POST /api/demo/cleanup` exist for one that is quiet. Deleting the
organization takes the workspace's rows with it through the cascades, and
the throwaway user goes too, because a demo that leaves accounts behind
leaks addresses nobody gave.

That table is installation state rather than workspace data: the
application role has no grant on it and no policy, so it cannot read it
even by mistake. Two locks, either of which alone would do.

## Off by default, and it opens a door

`DEMO=off` is the default, and while it is off the route answers 404 and
none of this code runs. That matters because `DEMO=on` hands out accounts,
which is exactly what `SIGNUP=closed` exists to prevent. The gate is
opened by a header the demo route sets on a call it makes server-side, so
it cannot be forged from a browser, and it only opens while `DEMO=on`.

Trade-off accepted: an installation running real work should not turn this
on. The deploy guide says so plainly and recommends a separate
installation for the demo.

## A GET that creates something

Unusual, and deliberate: the point is a link somebody can put on a
website. The usual objection — a crawler triggering it — costs a row that
expires within the day, and the rate limit (five an hour per address, two
hundred live demos at once) keeps that bounded. The page is not indexed.

## What a visitor is told

A stripe on every page says this is a demo, that it is deleted after 24
hours, and where to ask for a real account. The landing page says the same
before they click, including that we ask for no email. The terms page asks
them not to put real personal data in a demo, which is the honest request:
the data is deleted, but it passes through a database and a language model
on the way.
