import { describe, expect, it } from "vitest";
import config from "../../next.config";

/**
 * Every response carries the hardening headers, and nothing Ajour serves
 * may be framed - by anyone, itself included. The day a document needs to
 * be shown inside one of our own pages, that path gets SAMEORIGIN and this
 * test learns its name; until then DENY is the only answer.
 */

type Rule = { source: string; headers: Array<{ key: string; value: string }> };

describe("security headers", () => {
  it("applies the full set to every path", async () => {
    const rules = (await config.headers!()) as Rule[];
    expect(rules).toHaveLength(1);
    expect(rules[0]?.source).toBe("/(.*)");
    expect(Object.fromEntries(rules[0]!.headers.map((h) => [h.key, h.value]))).toEqual({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "X-Frame-Options": "DENY",
    });
  });
});
