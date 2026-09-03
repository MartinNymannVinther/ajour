/**
 * How long a share link may live. Three choices, not a date picker: a
 * link to a steering group is either for this project, for a quarter, or
 * for a month, and anything finer is a decision nobody wants to make.
 *
 * Kept apart from the service so the dialog can import it without pulling
 * the database driver into the browser bundle.
 */
export const SHARE_TTL_OPTIONS = [null, 30, 90] as const;
