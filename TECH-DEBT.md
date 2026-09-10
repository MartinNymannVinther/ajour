# Tech debt

What we know is not right yet, why it is not right, and what fixing it
would take. A debt item is written down when it is discovered and struck
out when it is paid — an item nobody can find is an item nobody pays.

CLAUDE.md's ways of working point at this file; this is it.

Opened at the pre-release review, September 2026, before publishing the
repository and deploying to ajour.haij.dk. Everything gating for that
release was fixed rather than written down; what is here is what was
deliberately left.

## Security

### The content policy still allows inline scripts

`next.config.ts` now sends a Content-Security-Policy, and it blocks
everything Ajour never uses: no external scripts, no framing, no
`<base>`, no form posting off-site. But `script-src` keeps
`'unsafe-inline'`, because Next.js writes its own bootstrap inline and
next-themes writes the one that sets the theme before first paint.

Closing it means a per-request nonce, set on the _request_ headers in
`src/proxy.ts` so Next stamps it onto its own scripts — and composed with
`next-intl`'s middleware, which builds its own response and will not
carry modified request headers by itself. It also forces every page to
render dynamically, which `src/app/[locale]/layout.tsx` currently avoids
with `generateStaticParams` and `setRequestLocale`.

That is a real trade with a real cost. It deserves its own change, with a
test, not a line in a hardening pass.

### GitHub Actions are pinned to moving tags

`.github/workflows/ci.yml` uses `actions/checkout@v4` and friends. `v4` is
a pointer somebody else can move. The gitleaks binary the secrets job
downloads is now checksum-verified, which was the sharper end of this,
but the actions themselves should be pinned to full commit SHAs with the
version in a trailing comment.

`.github/dependabot.yml` now watches the `github-actions` ecosystem, which
is what will keep SHA pins current once they exist. Pin them in one pass
and let Dependabot maintain them.

### The migrator image ships the whole development tree

`Dockerfile`'s `migrator` stage copies the full `node_modules`, so the one
image holding the Postgres superuser connection string also contains
eslint, vitest, prettier and the shadcn CLI. That is more code sitting
next to the highest-privilege credential in the deployment than the job
needs.

A `--prod` install was tried during the launch and reverted the same
hour. `pnpm db:migrate` runs both scripts through tsx, tsx is a
development dependency, and `pnpm add --prod tsx` on top of a `--prod`
install updates the manifest without placing the binary, because that
install mode skips development dependencies. The build succeeds, the
image looks fine, and the failure arrives at deploy time as
`sh: tsx: not found` after the database container is already healthy.
A Docker build cannot catch it; only running the image can.

The likeliest real fix is to stop calling tsx a development dependency.
It is not one: the migration step runs it in production, on every deploy.
Moving it to `dependencies` makes `--prod` correct and the classification
honest at the same time. The thing to check when doing it is
`pnpm audit --prod`, because tsx brings esbuild with it, and esbuild is
one of the two packages pinned by the overrides in `pnpm-workspace.yaml`.

Whatever the fix, it needs a test that runs the built migrator image
rather than merely building it.

### Rate limiting is per process

`src/core/rate-limit.ts` counts in memory, which is correct for one
container behind one proxy and says so. An installation scaled to several
instances gets a limit per instance rather than a limit. The file is
written so that it is the only one to replace; the call sites do not
change.

### AI call ceilings are per workspace, with no installation-wide roof

`src/modules/ai/limits.ts` counts 60 calls per user per hour and 600 per
workspace per day, both scoped by the tenant context. A user who belongs
to several workspaces therefore gets 60 × N, and an installation running
`DEMO=on` has no total ceiling at all. Worth an installation-level daily
cap read outside the tenant context before the demo is pointed at from
haij.dk.

### The workspace model key is bound to its workspace, but old ciphertexts are not

`src/core/crypto/secret-box.ts` seals as `v2` with the workspace id as
additional authenticated data, so a stored key only opens for the
workspace it was stored for. `v1` values are still read, without that
binding, so no installation loses its key on upgrade. Drop the `v1` path
once every installation has re-saved its key — and until then, a `v1`
ciphertext is still portable between rows.

## Product decisions parked

### Decisions are no longer on the public share page

`publicReport()` in `src/modules/share/service.ts` became an allow-list at
the pre-release review, and the decision log went out with the money and
the obstacles: decision notes carry the reasoning behind a choice, which
is internal even when the choice itself is visible in the plan.

That is a change of behaviour, not only of safety. If a participant with a
link should see the decisions, move `decisions` and `decisionsSince` from
the withheld block to the carried block — one line each — and update
`tests/share/share-links.test.ts`, which asserts the exact key set.

### The shared summary is prose, so it cannot be cut

This is the largest thing left, and it is worth reading twice.

A share link's read is an allow-list: no budget figures, no obstacle
list, no management asks, no decision log. But the _summary_ travels with
the link, word for word, and the engine that writes it puts the budget in
a sentence and names the open obstacles — because that is exactly what a
status written for a manager is for. `parts.join(" ")` in
`src/modules/ai/rules-engine.ts` produces one string, and the LLM path
produces free prose, so there is nothing structured left to withhold by
the time the report is frozen.

Three things were done about it now, and none of them is the fix:

1. `src/modules/reports/shared-text.ts` tells the manager, on the
   approval screen, which figures and which obstacle titles the words in
   front of them would say to a stranger — while the words can still be
   changed.
2. The share dialog's own copy stopped claiming more than it delivers:
   it now says the summary travels as written.
3. The public report is marked `redacted`, so the template keeps quiet
   instead of printing "nothing changed since last week" about a section
   whose contents were cut out, and heads the progress card "Fremdrift"
   rather than "Økonomi og fremdrift" when there is no money in it.

The actual fix is a structured summary: keep the sentences as parts with
a kind, not as one joined string, so the public copy can drop the money
part the same way it drops the money field. That works cleanly for the
rules engine. For the model path it means asking for the summary as
labelled parts rather than as prose, which is a change to the prompt
contract and to `StatusDraft`. Worth an ADR.

Until then, a manager who shares a link is trusted to have read their own
words. That is defensible — dogma five says the human decides — but it
should be a decision somebody made, not one nobody noticed.

### The daily tip's action still goes to the acting chat

`src/components/project/daily-tip.tsx` sends `tip.action` to
`sendChatAction`, which writes to the project. The sentence is shown
before the button is pressed, the change is snapshotted, and the snapshot
is now a precondition rather than a bonus — the chat no longer applies
anything it cannot undo.

The injection route into that sentence is closed at the source:
`recentActivity()` in `src/modules/ai/actions.ts` summarises free text
written through a share link rather than quoting it, so a stranger with
an answering link cannot write the imperative the tip proposes. The
status flow still gets the words in full, which is where they belong.

Worth revisiting if the tip ever grows a second acting path: a tip that
proposes a database write is a different thing from a tip that points at
a card, and only the second one is free.

## Code quality

### Files over 300 lines

Twelve, against a rule of one responsibility per file and no file over
roughly 300 lines. In rough order of how much the split would help:

| lines | file                                      | the seam                                                        |
| ----- | ----------------------------------------- | --------------------------------------------------------------- |
| 390   | `src/modules/projects/templates.ts`       | lines 26–364 are one literal array; move to `templates-data.ts` |
| 379   | `src/modules/share/service.ts`            | links vs the read model, at `readSharedProject`                 |
| 355   | `src/modules/demo/seed.ts`                | the DA/EN fixture content to `seed-content.ts`                  |
| 343   | `src/core/db/schema/projects.ts`          | plan tables vs journal tables                                   |
| 342   | `src/modules/ai/types.ts`                 | one file per flow: plan, status, chat, engine                   |
| 332   | `settings/access/access-admin.tsx`        | three components in one: requests, invite form, issued banner   |
| 326   | `src/components/project/project-view.tsx` | the JSX already splits into a main column and a sidebar         |
| 318   | `src/core/access/service.ts`              | applications vs invitations                                     |
| 316   | `projects/[id]/status/status-flow.tsx`    | the stage machine into `useStatusDraft(projectId)`              |
| 308   | `src/modules/reports/status-report.ts`    | build vs parse vs write                                         |
| 304   | `src/core/db/schema/foundation.ts`        | auth tables vs audit tables                                     |
| 303   | `src/components/project/timeline.tsx`     | geometry vs rendering                                           |

`src/modules/share/service.ts` and `src/components/project/timeline.tsx`
both grew past the line during the pre-release review itself.

### Six shared UI components nothing imports

`src/components/ui/` holds `alert.tsx`, `avatar.tsx`, `chip-input.tsx`,
`linked-row.tsx`, `segmented.tsx` and `select.tsx` — 538 lines with no
import site anywhere.

`select.tsx` is the one that matters: 190 lines of shared Select sitting
unused while six places hand-roll a `<select>` with the same copied class
string — `economy-card.tsx`, `task-editor.tsx`, `new-task-form.tsx`,
`share-dialog.tsx`, `state-select.tsx` and `settings/ai/model-form.tsx`.
Either adopt it in all six or remove it; shipping both is the worst of
the three options.

Nothing here has been deleted, because deleting is not this review's to
decide.

### Exports with no callers

`renameTask` (`write-tasks.ts`) and `TaskTitleSchema` (`validation.ts`)
lost their last caller when the unused `renameTaskAction` was removed at
the review. Also single-occurrence: `listPeople`, `withWorkspace`,
`moveMilestone`, `modelConfigured`, and `plural` in
`src/modules/ai/phrases.ts`, whose body ignores the locale it takes.

A further group is exported but used only inside its own file and should
simply lose the keyword: `restoreSnapshot`, `mailWords`,
`assessmentInputFor`, `personOnProject`, `cleanName`, `chosenEngine`,
`authPool`, `DialogClose`, and the `PAGE_W`/`MARGIN`/`GAP`/`LEFT_W` group
in `pdf-styles.ts`.

### Error handling coupled to a Postgres message string

`src/modules/export/workspace.ts` decides "not the owner" by matching the
text `only the workspace owner` against the exception raised in
`drizzle/0003_product_rls_audit.sql`. A later `CREATE OR REPLACE` that
rewords the message would silently degrade the branch to a generic
failure, and no test would notice. Raise with `ERRCODE = '42501'` and
match `error.code` instead.

### Two money formatters and three date formatters

`project-view.tsx` formats currency with `Intl.NumberFormat`;
`src/modules/ai/phrases.ts` hand-builds `"… kr."`. They agree today and
nothing keeps them agreeing. Medium dates are built from scratch in
`access-admin.tsx`, `settings/about/page.tsx` and `passkey-manager.tsx`;
`src/core/dates.ts` is the obvious home and has no locale-aware
formatter yet.

The PDF has two palettes: raw hexes in `pdf-styles.ts` partly duplicating
`INK` in `src/modules/reports/charts/types.ts` — `#fffdfa` is written out
in both — and `charts/gantt.ts` uses inline `"#ffffff"`/`"#4a463f"`
rather than `INK`.

### The web UI's font comes from Google at build time

`src/app/[locale]/layout.tsx` uses `next/font/google` for Archivo and
Geist Mono. Next downloads and self-hosts them, so there is no runtime
call to Google — but `pnpm build` and every `docker build` reaches out to
`fonts.googleapis.com`, which makes the build non-hermetic and puts a US
dependency in the build path of a project whose second dogma is that
cutting the internet must leave everything essential working.

`public/fonts` already ships Archivo Regular and SemiBold under the OFL,
and `README.md` attributes them — but those are used only by the PDF
renderer. Switching the UI to `next/font/local` needs a decision about
weight 500, which is not in the local set, and a local Geist Mono. It is
a typography change as much as a build change, which is why it was not
made during a security pass.

### Danish and English sentences live in TypeScript

`src/modules/ai/phrases.ts` is a second translation catalogue: `MONTHS`
plus a full `PhraseSet` of sentences that reach users as plan titles,
status drafts and tips. CLAUDE.md rule 8 says never hardcode UI strings.
The rules engine being pure and testable is a good reason, but it should
be a written exception in an ADR or moved behind the `Translate` callback
pattern that `src/modules/reports/words.ts` already uses well.
