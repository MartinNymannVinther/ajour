import { describe, expect, it } from "vitest";
import {
  describeTarget,
  explainDatabaseError,
  unencodedPasswordCharacter,
} from "../../scripts/migrate";

/**
 * The migration step must say what went wrong. drizzle-kit's own command
 * swallows every failure, and the first quickstart on a real machine ended
 * in "applying migrations..." and exit code 1 with nothing to go on. These
 * pin the explanations for the failures that actually happen.
 */

const target = "localhost:5432/ajour";

describe("explainDatabaseError", () => {
  it("names a server nobody reaches", () => {
    const { headline, hint } = explainDatabaseError({ code: "ECONNREFUSED" }, target);
    expect(headline).toContain("Nothing answers on localhost:5432/ajour");
    expect(hint).toContain("--wait");
  });

  it("names a missing database and points at the port clash that causes it", () => {
    const { headline, hint } = explainDatabaseError(
      { code: "3D000", message: 'database "ajour" does not exist' },
      target,
    );
    expect(headline).toContain("does not exist");
    expect(hint).toContain("POSTGRES_PORT=5433");
  });

  it("names a refused password", () => {
    expect(explainDatabaseError({ code: "28P01" }, target).headline).toContain("Password refused");
  });

  it("looks through Drizzle's wrapper to the database's own error", () => {
    const wrapped = { message: "Failed query: select 1", cause: { code: "57P03" } };
    expect(explainDatabaseError(wrapped, target).headline).toContain("still starting up");
  });

  it("falls back to the error's own words", () => {
    expect(explainDatabaseError(new Error("syntax error at or near GRANT"), target)).toEqual({
      headline: "syntax error at or near GRANT",
    });
  });
});

describe("describeTarget", () => {
  it("names host, port and database, never the password", () => {
    expect(describeTarget("postgres://postgres:secret@db:5433/ajour")).toBe("db:5433/ajour");
    expect(describeTarget("postgres://postgres:secret@localhost/ajour")).toBe(
      "localhost:5432/ajour",
    );
  });
});

describe("a password that ends the URL", () => {
  /**
   * The failure that cost the first Ajour deployment a round: db came up
   * healthy, migrate died with exit 1, and the reason was a `/` in a
   * base64 password. The container is unaffected because it receives the
   * password as a plain variable; only the URL breaks, and the URL is
   * what this script dials.
   */
  it("is named, with the character to blame", () => {
    expect(unencodedPasswordCharacter("postgres://postgres:ab/cd@db:5432/ajour")).toBe("/");
    expect(unencodedPasswordCharacter("postgres://postgres:ab?cd@db:5432/ajour")).toBe("?");
    expect(unencodedPasswordCharacter("postgres://postgres:a@b@db:5432/ajour")).toBe("@");
  });

  it("stays quiet about a password that is fine", () => {
    expect(unencodedPasswordCharacter("postgres://postgres:0a1b2c3d4e5f@db:5432/ajour")).toBe(null);
    // base64 without the dangerous characters is still a valid URL.
    expect(unencodedPasswordCharacter("postgres://postgres:ab+cd=@db:5432/ajour")).toBe(null);
  });

  it("does not trip over a URL with no credentials at all", () => {
    expect(unencodedPasswordCharacter("postgres://db:5432/ajour")).toBe(null);
    expect(unencodedPasswordCharacter("not-a-url")).toBe(null);
  });
});
