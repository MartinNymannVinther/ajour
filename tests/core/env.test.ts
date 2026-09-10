import { describe, expect, it } from "vitest";
import { EnvSchema } from "@/core/env";

/**
 * The environment is the boundary an operator crosses on launch day, and
 * the errors it gives are the only help they get at that moment. These
 * pin the two guards and the one hint that exist because getting them
 * wrong is quiet rather than loud.
 */

const REQUIRED = {
  APP_DATABASE_URL: "postgres://app:app@localhost:5432/ajour",
  AUTH_DATABASE_URL: "postgres://auth:auth@localhost:5432/ajour",
  BETTER_AUTH_SECRET: "not-a-real-secret-for-tests-only",
};

function failure(env: Record<string, string>): string {
  const result = EnvSchema.safeParse(env);
  expect(result.success).toBe(false);
  return result.success ? "" : JSON.stringify(result.error.issues);
}

describe("the database URLs", () => {
  /**
   * docker-compose.yml builds these by pasting a password into
   * postgres://user:PASSWORD@db:5432/ajour. `openssl rand -base64` emits
   * `/`, `+` and `=`, and a slash ends the authority part of a URL. The
   * deploy guide asked for base64 until the pre-release review, so this
   * was a real trap: the app refuses to start, the message names
   * APP_DATABASE_URL, and the thing that is wrong is a password.
   */
  it("say what to do when a base64 password broke the URL", () => {
    const broken = failure({
      ...REQUIRED,
      APP_DATABASE_URL: "postgres://ajour_app:ab/cd+ef=@db:5432/ajour",
    });
    expect(broken).toContain("openssl rand -hex 24");
  });

  it("accept a hex password, which is what the guide now asks for", () => {
    expect(
      EnvSchema.safeParse({
        ...REQUIRED,
        APP_DATABASE_URL: `postgres://ajour_app:${"a1b2c3".repeat(8)}@db:5432/ajour`,
      }).success,
    ).toBe(true);
  });
});

describe("in production", () => {
  const PROD = { ...REQUIRED, NODE_ENV: "production", BETTER_AUTH_URL: "https://ajour.haij.dk" };
  const STRONG = "P4ssPhraseLongEnoughForProductionUse0123456789";

  it("refuses the secret published in .env.example", () => {
    // It is in the repository. It also derives the key that encrypts every
    // workspace's model API key, so an installation running on it is
    // handing both away.
    expect(
      failure({ ...PROD, BETTER_AUTH_SECRET: "dev-only-secret-change-me-in-production" }),
    ).toContain("BETTER_AUTH_SECRET");
  });

  it("refuses a secret that is merely short", () => {
    expect(failure({ ...PROD, BETTER_AUTH_SECRET: "sixteen-chars-ok" })).toContain(
      "at least 32 characters",
    );
  });

  it("refuses a public URL that is not https", () => {
    expect(
      failure({ ...PROD, BETTER_AUTH_SECRET: STRONG, BETTER_AUTH_URL: "http://ajour.haij.dk" }),
    ).toContain("https");
  });

  it("accepts a properly generated pair", () => {
    expect(EnvSchema.safeParse({ ...PROD, BETTER_AUTH_SECRET: STRONG }).success).toBe(true);
  });

  it("holds development to none of it, so localhost still works", () => {
    expect(
      EnvSchema.safeParse({
        ...REQUIRED,
        NODE_ENV: "development",
        BETTER_AUTH_SECRET: "dev-only-secret-change-me-in-production",
        BETTER_AUTH_URL: "http://localhost:3000",
      }).success,
    ).toBe(true);
  });
});
