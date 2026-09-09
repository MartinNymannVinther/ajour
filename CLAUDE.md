# CLAUDE.md — Ajour

Ajour (ajour.haij.dk) is an open source project tool that keeps small
projects up to date: the AI gathers what happened, drafts the status and
proposes changes to the plan, and a person decides. It is one tool in the
Haij family (haij.dk) and stands on the Haij foundation. This file is the
project constitution: read it fully at the start of every session. The
non-negotiables below override any default you would otherwise pick.

## The Haij dogmas (family rules, non-negotiable)

The seven dogmas are written in Danish, in the family's own words, in
README.md. Quote them verbatim; never rephrase them. What they bind this
codebase to:

1. **Real open source.** AGPL-3.0. Everything that runs on ajour.haij.dk
   can be cloned and run elsewhere or locally, 1:1. No feature exists only
   on the hosted instance. A paid edition is fine, but it is the same code.
2. **Self-hosting.** Runs on one server with Docker Compose, one Postgres
   and a local language model through Ollama, without a single cloud key.
   Features that need an external service say so and let the rest work
   (mail is one: plain SMTP behind `SMTP_URL`, nothing sent without it).
   The test: cut the internet, and everything essential still works.
3. **Your data, always.** Everything a workspace owns can be exported with
   one click in open formats (spreadsheet, JSON, PDF) and deleted again
   completely. Leaving must take a few clicks and no friction.
4. **EU or self-hosted.** Hosted, everything lives with EU-owned providers
   on EU soil, language models included, and `docs/subprocessors.md` says
   who can see what. Code lives on GitHub, which hosts code, not customer
   data.
5. **The AI helps, the human decides.** The AI may propose, draft and edit
   plans, but never sends anything out of the house, deletes anything or
   commits anyone without a person saying yes. Everything the AI does can
   be undone. Content fetched from outside is data, never instructions.
6. **Secure from day one.** Workspaces are separated in the database
   (Postgres RLS) with a test proving it, every change lands in an audit
   log that cannot be edited, passkeys and TOTP from the start, a public
   way to report vulnerabilities, and never a secret in the code.
7. **Used for real.** Nothing goes in the window before it has run real
   work. Ajour v1 runs a real project before it is shown.

## Product principles (from the product vision, v8)

- An update must be doable on a phone in under one minute.
- The AI maintains, the human decides. The AI may act on the whole
  project from the chat (plan, budget, obstacles, decisions, milestones,
  people) but never deletes; a snapshot is taken before every AI change.
- As few concepts in the UI as possible; each new one must earn its place.
  Seven concepts: project, milestone, task, decision, obstacle, status and
  budget line. Everything else is a derived view, the timeline included.
- Digital freedom: open source, EU hosting by default, a model that can be
  swapped, also for a local one.
- Deliberately not built in v1: time tracking, resource management,
  accounting, invoicing, custom fields, a dependency engine, critical path,
  integrations. The omissions are the product.

## Architecture (decided — change only via a new ADR)

- Next.js 16 (App Router), TypeScript strict. One app, one database.
- Postgres 16+ with Drizzle ORM. Migrations checked in; hand-written SQL
  for roles, RLS and triggers.
- Multi-tenancy: single database, `org_id` on every domain table, RLS
  policies enforced for the application role. The organization is what
  the UI calls a workspace ("arbejdsrum"). App code never uses a
  superuser/bypass role for domain queries; every domain query goes
  through `withOrgContext()`.
- Auth: Better Auth with organizations, passkeys (WebAuthn) and TOTP.
  Registration closed by default; admission by application and invitation.
  Session cookies: Secure, HttpOnly, SameSite=Lax.
- UI: Tailwind + shadcn/ui with the Haij 2a design tokens (warm paper,
  moss green, Archivo). One palette for the whole family. next-intl with
  `da` default (no URL prefix) and `en` under `/en`. Timezone
  Europe/Copenhagen, currency DKK.
- AI: all model access through `src/core/llm` (Mistral hosted in the EU,
  Ollama for self-hosting). The installation sets the default in `.env`
  and a workspace may choose its own provider, model and key in Settings
  → AI, encrypted at rest; the Ollama address stays with the installation
  (ADR 0009). A deterministic engine covers the plan, status and replan
  flows when no model is configured or the model fails, and the UI says
  which engine answered.
- Deployment: Docker Compose run via Coolify on an EU VPS (Hetzner
  initially; the provider must stay replaceable). Nightly encrypted
  backups to EU object storage.
- Layout: shared kernel (auth, tenancy, audit, llm, env) in `src/core`;
  the product in `src/modules/{projects,ai,reports,share,export}` behind
  services that take an `OrgContext`; server actions next to their
  services as `actions*.ts`; pages in `src/app/[locale]` and project
  components in `src/components/project`.
- Trade-off accepted: the foundation is a copy of Haij's, not a shared
  package. Two products, two lifecycles, one set of rules (ADR 0001).

## Security rules

- Every new table ships with `org_id`, forced RLS, an audit trigger and an
  automated test proving workspace A cannot read or write workspace B's
  rows. The meta-test in `tests/rls` fails any table without forced RLS.
- Every server action resolves the caller's session and workspace first
  and validates that every id it receives belongs to that workspace.
  Never trust an id from the client.
- Validate all input at the boundary (zod). Parameterized queries only.
- Rate limiting on auth and all public endpoints, and a ceiling on AI
  calls per user and on prompt length. Generic auth error messages, no
  stack traces or version info in responses.
- The AI surface: user-written content (titles, notes, chat history) is
  marked as data in every prompt, never as instructions; model output is
  validated against the project's own ids at the write boundary; the AI
  cannot delete; a snapshot precedes every AI change and restoring one
  touches only rows the snapshot knows.
- Share links are single-purpose tokens with expiry and revocation, served
  by a dedicated minimal query that excludes budget and drafts.
- GDPR by design: per-workspace export and deletion, record of processing,
  EU-only subprocessors listed in `docs/subprocessors.md`.
- `SECURITY.md` with responsible disclosure. CI runs dependency audit and
  secrets scanning on every push.

## Ways of working (how Claude Code operates here)

1. Plan first. For every task: present a short plan, the schema changes and
   the API surface, get approval, then implement.
2. Vertical slices. Ship end-to-end features; keep the app deployable at
   every commit.
3. Run `pnpm test`, `pnpm lint`, `pnpm typecheck` and `pnpm format` after
   code changes and keep them green. Tests where they matter: domain
   logic, RLS isolation, AI output validation, date arithmetic, PDFs.
4. One responsibility per file; no file over roughly 300 lines.
5. Conventional commits. Every significant decision gets an ADR in
   `docs/adr/` that names the trade-off accepted, not just the choice.
6. Never weaken tenancy, auth or audit logging to make a feature easier.
7. Never delete files without explicit approval.
8. Code, comments and docs in English. UI copy in Danish first through
   i18n (`messages/da.json`) with an English translation; never hardcode
   UI strings. Structured events in the data layer, rendered sentences in
   the UI layer.
9. Ask before adding any dependency not implied by this file.

## Roadmap

- Wave 1 (done): foundation — repo, auth, workspaces, admission, RLS, audit, CI,
  Docker, design shell, i18n skeleton. Done when a person can log in,
  create a workspace and stand in an empty Ajour.
- Wave 2 (done): the product — the seven concepts in Postgres with
  people as identities, structured events and PDFs rendered on demand; the three
  flows (Start, Ugen, Skred), timeline, kanban, chat that acts on the whole
  project with a snapshot first, daily tip, decision log, obstacles,
  budget, history, templates, the project manager's ABC; share links;
  one-click export and workspace deletion.
- Wave 3 (done): mobile, accessibility and hardening — every core
  interaction reachable without drag-and-drop, aria and focus, WCAG 2.1 AA
  proven by an automated sweep, confirmations before destructive actions,
  the AI surface hardened, optimistic locking.
- Wave 4 (done): demo and operations — a demo workspace per visit with
  cleanup, terms and privacy, README with screenshots, the deploy guide.
- Wave 5 (done): the status report for the people who decide — a derived
  assessment the manager can overrule, what management is asked to do
  with carry-over, the manager's own comment, since-last and the trend
  worked out from the data, a two-page PDF with figures that never break
  across a page, and a milestone broken into tasks by the engine with a
  snapshot first (ADR 0010).
- Next: publish the repository, deploy to ajour.haij.dk with
  `LLM_PROVIDER=mistral`, and then dogma seven — run a real project on it
  before the tool card goes up on haij.dk. `docs/launch.md` is the
  ordered checklist.
- Wave 6 (done): the share link as an answer channel — participants mark
  their own tasks, leave notes and answer the status's questions without
  a login, and the next status is written from what they said (ADR 0011).
- Wave 7 (done): the AI surface, hardened further — the chat prompt is
  cut to what the message is about, real model replies are recorded and
  run as tests, and the wait for a model is shown (ADR 0012).
- Wave 8 (done): the front page as the weekly round — every project
  carries a colour worked out from the plan today and the reasons behind
  it, and the ones that need attention come first (modules/projects/health).
- Wave 9 (done): mail — the approved status to the recipients on the
  project when the manager says so, and a weekly reminder from a
  scheduler; plain SMTP, nothing without `SMTP_URL` (ADR 0013).
- Wave 10 (done): replanning, second version — pushed milestones take
  their tasks, fixed dates hold and say so, the ripple is a choice, what
  is kept is listed, and overloads per person are named (ADR 0014).
