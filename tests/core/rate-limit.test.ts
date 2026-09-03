import { beforeEach, describe, expect, it } from "vitest";
import { callerKey, rateLimit, resetRateLimits } from "@/core/rate-limit";

/**
 * The limiter guarding the public endpoints. It is in memory on purpose;
 * these tests pin the behaviour that decision rests on, so replacing it
 * with a shared store later is a swap rather than a rewrite.
 */

beforeEach(() => resetRateLimits());

describe("rateLimit", () => {
  it("allows up to the limit and refuses the one after", () => {
    for (let i = 0; i < 5; i++) expect(rateLimit("a", 5, 60_000).allowed).toBe(true);
    const refused = rateLimit("a", 5, 60_000);
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts each key on its own", () => {
    for (let i = 0; i < 5; i++) rateLimit("a", 5, 60_000);
    expect(rateLimit("b", 5, 60_000).allowed).toBe(true);
  });

  it("forgets a key once its window has passed", async () => {
    expect(rateLimit("c", 1, 20).allowed).toBe(true);
    expect(rateLimit("c", 1, 20).allowed).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(rateLimit("c", 1, 20).allowed).toBe(true);
  });
});

describe("callerKey", () => {
  it("reads the first address the proxy reports", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    expect(callerKey(headers, "share")).toBe("share:203.0.113.7");
  });

  it("falls back to x-real-ip, and then to one shared bucket", () => {
    expect(callerKey(new Headers({ "x-real-ip": "203.0.113.9" }), "share")).toBe(
      "share:203.0.113.9",
    );
    // No header at all: everyone shares a bucket, which fails closed.
    expect(callerKey(new Headers(), "share")).toBe("share:unknown");
  });
});
