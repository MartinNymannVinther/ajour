/**
 * What a full export contains, and what it deliberately leaves out.
 *
 * The list is written by hand rather than derived from the schema, because
 * "everything in the database" is the wrong answer twice over: it would
 * carry secrets out of the system, and it would silently start including
 * whatever table someone adds next. A new table appears in the export when
 * a person decides it should, which is the same discipline the tenancy
 * checklist asks for.
 *
 * Order matters: it is the order of the tabs in the spreadsheet, and it
 * runs from the things a person recognizes (projects, tasks) toward the
 * technical ones (audit trail).
 */

export type ExportTable = {
  /** Database table, from this fixed list and never from user input. */
  table: string;
  /** Tab name in the spreadsheet, and key in the JSON export. */
  sheet: string;
  /** Columns never written out, whatever they contain. */
  redact?: string[];
  /** Column to sort by; falls back to the primary key's insertion order. */
  orderBy?: string;
};

export const EXPORT_TABLES: ExportTable[] = [
  { table: "projects", sheet: "Projekter", orderBy: "created_at" },
  { table: "people", sheet: "Personer", orderBy: "name" },
  { table: "milestones", sheet: "Milepæle", orderBy: "date" },
  { table: "tasks", sheet: "Opgaver", orderBy: "start_date" },
  { table: "task_participants", sheet: "Deltagere", orderBy: "task_id" },
  { table: "decisions", sheet: "Beslutninger", orderBy: "created_at" },
  { table: "obstacles", sheet: "Forhindringer", orderBy: "created_at" },
  { table: "expenses", sheet: "Økonomiposter", orderBy: "created_at" },
  { table: "status_updates", sheet: "Statusser", orderBy: "created_at" },
  { table: "snapshots", sheet: "Plan-historik", orderBy: "created_at" },
  { table: "events", sheet: "Hændelser", orderBy: "created_at" },
  { table: "chat_messages", sheet: "AI-chat", orderBy: "created_at" },
  { table: "tips", sheet: "Dagens tip", orderBy: "day" },
  {
    table: "share_links",
    sheet: "Delelinks",
    // The hash is the credential and never leaves the system.
    redact: ["token_hash"],
    orderBy: "created_at",
  },
  { table: "audit_log", sheet: "Revisionsspor", orderBy: "created_at" },
];

/**
 * Left out on purpose:
 *
 * - `ai_calls`: a counter for rate limiting, not something a workspace owns.
 * - Everything Better Auth owns (users, sessions, accounts, passkeys, two
 *   factors, rate limits). Sessions and passkeys are credentials, and the
 *   people are exported as members below rather than as auth rows.
 * - `access_requests` and `access_invitations`: they belong to the
 *   installation, not to any workspace, and describe people who are not
 *   users of it. The application role cannot read them anyway.
 */
export const MEMBERS_SHEET = "Brugere";
