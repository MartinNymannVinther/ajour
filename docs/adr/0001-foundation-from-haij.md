# ADR 0001: Ajour stands on a copy of the Haij foundation

Status: accepted · Date: 2026-09-03

## Context

Ajour began as a clickable prototype (Next.js, SQLite, no login, a local
Ollama and a deterministic fallback engine) built to prove the product
experience: three flows, a timeline, a chat that acts on the plan. A
critical review of that prototype by five roles agreed on one thing above
all: the product idea holds, and the foundation has to be designed right
before anything else is built on it — authorization in every action,
people as identities, a tenant axis, transactions, an audit trail.

Haij, the family's business platform, already has exactly that foundation
in production: Better Auth with passkeys and TOTP, organizations with
Postgres RLS enforced through two confined database roles, an append-only
audit log written by triggers, admission by application and invitation,
CI with dependency audit and secrets scanning, Docker Compose deployed
through Coolify, and the 2a design system.

## Decision

Ajour is its own repository and its own application, deployed as its own
compose stack on ajour.haij.dk. Its foundation is a copy of Haij's, taken
at Haij commit `0be9a76` and adapted: the same stack (Next.js 16, Postgres
16, Drizzle, Better Auth, Tailwind + shadcn/ui, next-intl, pnpm, Vitest),
the same tenancy model (ADR 0002), the same audit model (ADR 0003), the
same admission model (ADR 0004), the same design tokens and shell, the
same CI gates and deployment shape. Every Haij-specific module (CRM, time,
invoicing, signals, knowledge, MCP) was removed rather than disabled; the
schema starts from a single migration that contains only the foundation.

The organization is what the UI calls a workspace ("arbejdsrum"): Ajour's
users include associations and volunteers, for whom "organization" is the
wrong word, while the code keeps Better Auth's name for the thing.

## Alternatives rejected

- **A module inside Haij.** One app, one foundation, no copy. Rejected:
  Ajour's audience (anyone running a small project, associations and
  volunteers included) would have to enter a consultancy's business
  platform, Haij already has a small project module that overlaps, and the
  two products have different lifecycles and different people at the door.
- **A shared `haij-core` package.** The foundation as a library both apps
  depend on. Rejected for now: two consumers is one too few to pay for a
  package boundary, and a foundation that has to serve two products at
  once changes more carefully than one that serves each on its own. It
  stays possible: the copied code is confined to `src/core`, the
  migrations and the tests, and drift between the two can be reviewed by
  diff.
- **Growing the prototype in place.** Adding auth and Postgres to the
  SQLite prototype. Rejected: the prototype was built to be felt, not to
  be operated, and every one of the review's foundation findings is
  cheaper to get right in a codebase that already has the answer than to
  retrofit.

## Trade-offs accepted

- **Two copies of the foundation.** A fix in Haij's auth, tenancy or audit
  code does not reach Ajour by itself. The cost is bounded by keeping the
  copied code unchanged where possible and naming the Haij commit it came
  from; the escape hatch is the shared package, when a third tool makes it
  worth it.
- **Two databases and two auth systems on one server.** A person who uses
  both Haij and Ajour has two accounts. Accepted: the tools are separate
  products, and a shared identity across the family is a later decision
  that must not be forced by an implementation shortcut now.
- **Better Auth's vocabulary leaks.** Tables are named organizations and
  memberships while the UI says workspace. Accepted: renaming the
  library's tables buys nothing and costs every future upgrade.
