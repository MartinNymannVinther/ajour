# Subprocessors

Per the Haij dogmas, every subprocessor must be EU-owned and EU-hosted,
and must be listed here **before** it is taken into use. This is the
public list of who can see what for the installation at ajour.haij.dk. A
self-hosted Ajour with `LLM_PROVIDER=ollama` has no subprocessor at all
beyond the machine it runs on.

| Subprocessor        | Purpose                                                   | Data                                                                                                  | Location      | Added      |
| ------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------- | ---------- |
| Hetzner Online GmbH | Hosting: the VPS running Docker and the database          | Everything the installation holds                                                                     | Nuremberg, DE | 2026-09-03 |
| Mistral AI          | LLM adapter: plan proposals, status drafts, replans, chat | The text of the project the feature works on: names, tasks, milestones, notes, chat messages (wave 2) | Paris, FR     | 2026-09-03 |

## What each one does and does not see

**Hetzner** hosts the machine, so it holds everything by definition: the
database, the backups on their way out, the logs. That is unavoidable for
any hosted deployment and is why the choice of provider matters and why
the exit plan in `docs/deploy.md` is a design requirement rather than a
nicety.

**Mistral** receives what a prompt contains and nothing else. In Ajour
that is the project the person is working on: its description, goals,
milestones, tasks, obstacles, decisions and the message typed into the
chat. The budget is sent only when the person asks the AI about it.
Passwords, passkeys, sessions and the audit log are never sent, and
nothing is sent at all until the product's AI features arrive in wave 2.
Everything a person or a participant has written is treated as data in
the prompt, never as instructions, which is the prompt-injection defense,
not a privacy measure — both matter, for different reasons.

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
