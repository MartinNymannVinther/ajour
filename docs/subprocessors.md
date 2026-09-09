# Subprocessors

Per the Haij dogmas, every subprocessor must be EU-owned and EU-hosted,
and must be listed here **before** it is taken into use. This is the
public list of who can see what for the installation at ajour.haij.dk. A
self-hosted Ajour with `LLM_PROVIDER=ollama` has no subprocessor at all
beyond the machine it runs on.

| Subprocessor        | Purpose                                                                              | Data                                                                                                                                                      | Location                                                      | Added      |
| ------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------- |
| Hetzner Online GmbH | Hosting: the VPS running Docker and the database                                     | Everything the installation holds                                                                                                                         | Nuremberg, DE                                                 | 2026-09-03 |
| Mistral AI          | LLM adapter: plan proposals, status drafts, replans, chat, the daily tip             | The project the feature works on: names of people, tasks, milestones, obstacles, decisions, the budget and its lines, chat messages. Written out below.   | EU/EFTA data centres, via `api.eu.mistral.ai`                 | 2026-09-03 |
| _(mail provider)_   | Outgoing mail: the approved status to its recipients, the weekly reminder (ADR 0013) | The project's name, the status summary, the manager's comment, the PDF, the recipients' addresses; for the reminder, project names and members' addresses | _to be named before `SMTP_URL` is set on the hosted instance_ | —          |

## What each one does and does not see

**Hetzner** hosts the machine, so it holds everything by definition: the
database, the backups on their way out, the logs. That is unavoidable for
any hosted deployment and is why the choice of provider matters and why
the exit plan in `docs/deploy.md` is a design requirement rather than a
nicety.

**Mistral** is a French company, and that is not by itself the answer to
where the data goes. Mistral runs three endpoints: `api.mistral.ai`,
`api.eu.mistral.ai` and `api.us.mistral.ai`, and they state that they do
not commit to any particular inference location for the first of them.
Ajour calls the EU one, and `MISTRAL_BASE_URL` in the environment is what
decides it, so it is an installation's choice and not a workspace's. The
regional endpoints cost 1.1x list price; that is what this row costs.

The location column said "Paris, FR" until the pre-release review in
September 2026, while the code called the endpoint with no location
commitment. That was wrong, and it is the second correction on this page.
Both are left visible rather than tidied away, because a list like this
one is worth exactly as much as its worst entry.

Mistral receives what a prompt contains and nothing else. Written out
rather than summarised, because "the project" is vague and the point of
this list is that it is not:

- **Starting a project**: the description the person typed, and nothing
  else. No existing project is in that prompt.
- **The chat, and the daily tip**: the project's name, goal, the names of
  its owner and manager, every milestone with its date and acceptance
  criterion, every task with its dates, state, owner and participants and
  its checklist, the open obstacles, the last ten decisions, **the budget
  and every money line with its amount and whether it has been spent**,
  the recent activity as sentences, and the last eight messages of the
  chat itself.
- **The weekly status**: the same, minus the individual money lines — the
  budget, the planned and incurred totals and the number of lines go, the
  lines themselves do not — plus the previous approved status, the
  derived assessment and its reason, the "since last" lines, and the text
  of what management was asked for last week and has not answered.
- **Breaking a milestone into tasks**: the project's name and goal, the
  milestone's title, date, criterion and owner, the titles of tasks
  already under it, and the names of the people in the project.
- **A replan**: only the moved milestone, the tasks hanging on it and the
  later milestones. In practice this one is computed locally by the rules
  engine and reaches no model at all.

So the money is sent. An earlier version of this page said the budget went
only when the person asked about it, which was true of an earlier design
and is not true now; a workspace that does not want its figures leaving
the machine should run `LLM_PROVIDER=ollama`, which is the reason that
option exists.

## A workspace can choose a different one

Since ADR 0009, a workspace may set its own provider, model and API key in
Settings → AI. Mistral is the default on ajour.haij.dk and the one this
list covers, and it is what every workspace uses until it says otherwise.
A workspace that chooses differently has chosen its own processor: its
project text then goes to the provider named on its own settings page,
under whatever agreement it has with them, and this list no longer
describes it. A workspace that sets the provider to "none" sends nothing
to any model at all and runs on the rules engine.

The Ollama address is not part of that choice — it belongs to the
installation — so on the hosted instance the real options are Mistral or
no model. The key a workspace stores is encrypted at rest and is never
readable from the interface; the settings page says which key is in force,
the installation's or the workspace's own.

The names in a project are people's names, and they are usually
colleagues rather than the account holder. That is personal data going to
a subprocessor, which is why it is named here and why the terms page says
so in plain language.

Passwords, passkeys, session tokens, the audit log, share-link tokens and
anything belonging to another workspace are never sent. Everything a
person has written is placed in the prompt as data, never as instructions,
which is the prompt-injection defence rather than a privacy measure —
both matter, for different reasons.

## Not subprocessors, but worth naming

**GitHub** holds the source repository. It processes no installation
data, so it is a development dependency rather than a subprocessor, but
it is US-owned and that is worth stating plainly rather than leaving for
a reader to discover. Nothing about the installation's operation depends
on it: the deployment runs from a Docker image, and the repository can be
mirrored or moved without touching production.

**Let's Encrypt** issues the TLS certificate and therefore learns the
hostname, which is public in DNS anyway.

Adding anything to this list is a decision, not a formality. Before a new
row goes in: what data does it receive, could the feature work without
sending it, and what happens to the installation the day that provider
disappears.
