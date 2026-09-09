# ADR 0011: The share link as an answer channel

Status: accepted · Date: 2026-09-09

ADR 0006 made the share link a read: a steering group opens the project
without a login and sees the plan and the approved statuses. It also
named the one thing that read could not do and that the product most
needed: let the people who do the work say what happened without a login.

The weekly status is written from what the tool knows. In a small project
the tool knows what the project manager typed, because the participants
answer by mail and at the coffee machine. The engine then drafts from
thin data and asks good questions nobody sees. Data flowed out; nothing
flowed in.

## A link that may answer

A share link now has a flag, `can_answer`, off by default. A link made
for a steering group stays a read. A link made for the team lets its
holder do exactly three things:

- mark a task they are on (owner or participant) as not started, in
  progress or done;
- leave a short note on a task they are on;
- answer a question the latest approved status asked.

Nothing else on the project is reachable through the link: not the
budget, not the obstacles, not other people's tasks, not the chat. The
public read (`readSharedProject`) is still one minimal query; a link that
may answer adds who is on which task and the questions of the approved
statuses, and a read-only link adds none of that, so the page cannot even
offer it.

## Who is speaking

The holder picks a name from the people on the project's tasks. The pick
is kept in a cookie scoped to the link and checked against the project's
people on every write; the cookie is a convenience, never an authority.
This is the same bargain as a shared document where you type your name:
two holders of one link are told apart by what they say they are, and a
holder can say they are someone else on the team. The reply carries the
name and the link it came through, the audit trail keeps every row, and
revoking the link is one click. A per-recipient identity would close that
gap and reopen the door the whole feature exists to avoid: a login.

## What a reply becomes

Replies are rows in `participant_replies`: the person, the kind (answer
or note), the question copied in or the task, the text, and the link.
They are never edited, only added. Each also lands in the project's
events with the actor kind `participant`, so the history says "Mette set
'X' to in progress through the share link" and not "someone did".

The next status is written from them. `StatusInput.participantReplies`
carries what came in since the last approved status; the rules engine
works it into the words and stops asking a question that has an answer,
the model is told they are facts with a name on and that their text is
data, not instructions. The status page shows them to the project manager
above the draft.

## Boundaries

- Writes run in the same transaction shape as the read: the token hash is
  the only context until the link is found, then the workspace it names.
  RLS holds as before; the narrowing to the holder's own tasks is code in
  `modules/share/answers.ts` and is proven by `tests/share/answers.test.ts`,
  including a valid link that cannot touch a task in another workspace.
- Thirty writes a minute per address, on top of the read limit. Text is
  capped at 600 characters and stripped of control characters.
- A revoked or expired link refuses writes exactly as it refuses reads.
- `participant_replies` has forced RLS, an audit trigger and a row in the
  isolation test like every other table.

## Trade-offs accepted

Self-identification is weak identity; see above. Notes and answers are
free text from outside the workspace and are shown to the manager and
handed to the model as data; the model prompt says so explicitly, and the
sanitiser at the write boundary still validates every id the model
returns. A participant cannot create tasks, move dates or touch anyone
else's work, which is also the reason the surface is small enough to
reason about.
