# ADR 0006: Share links

Status: accepted · Date: 2026-09-03

A weekly status is worth writing because somebody reads it. Most of those
somebodies — a board, a steering group, a customer, the rest of the
association — will never have a login here, and asking them to get one is
how a status ends up pasted into an e-mail instead.

So a project can be opened by a link: `/s/<token>`, no session, no
account, read only.

## The token is a credential, so it is stored like a password

A link is 144 random bits, base64url. The database stores only its
sha256 hash. A link can therefore be revoked and remade but never looked
up, which is why the interface shows it once, at creation, and says so.

Each link carries a label, an optional expiry (none, 30 or 90 days), who
made it, when it was last used, and when it was revoked. Revoking is a
timestamp, not a delete, so the audit trail keeps the fact that the link
existed.

## The public read is a separate query, not the ordinary one with a filter

The page does not call the project read and hide fields. It calls
`readSharedProject`, which is its own minimal query: the name, the goal,
the milestones, the tasks and the approved statuses. There is no code
path from that page to the budget, the obstacles, the drafts, the chat or
the events, so no future feature can accidentally widen it — a field that
is not selected cannot leak.

The frozen status report does carry the money and the obstacles, because
the workspace's own PDF needs them; those two fields are cut on the way
out to the public page, and a test asserts it.

## How it reaches the database without a workspace

The application role has no session here, so RLS has nothing to key on.
The transaction sets `app.share_hash` to the presented hash; a policy on
`share_links` lets exactly the row with that hash be read. Once the row
is found, the transaction sets `app.org_id` to the workspace it names,
and the ordinary policies take over for the rest of the read. Until the
token matches something, the connection can see nothing at all —
`tests/rls/product-isolation.test.ts` proves both halves.

## Trade-offs accepted

Anyone holding the link can read it: there is no per-recipient identity,
no view log per person, and forwarding the link forwards the access. That
is the same bargain as a shared document link, and it is the reason
expiry and revocation are one click each and the money is never on it.

The page is marked `noindex` and served without caching, but a link that
ends up in a public place is public. The answer is to revoke it, which is
why the dialog lists live links with their labels rather than hiding them
after creation.

After v1 the same token is the natural place to let a participant answer
the AI's questions and tick their own tasks without a login. That would
turn the link from a read into a write, and it will need its own ADR:
rate limiting, a narrower write surface, and a way to tell two holders of
the same link apart.
