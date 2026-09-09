import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import config from "../../next.config";

/**
 * Every response carries the hardening headers, and nothing Ajour serves
 * may be framed - by anyone, itself included. The day a document needs to
 * be shown inside one of our own pages, that path gets SAMEORIGIN and this
 * test learns its name; until then DENY is the only answer.
 *
 * The set is asserted exactly rather than by presence, so a header
 * quietly dropped fails here. HSTS is the one exception: it is
 * production-only, because a browser told that localhost speaks HTTPS
 * believes it for two years.
 */

type Rule = { source: string; headers: Array<{ key: string; value: string }> };

async function headerMap(): Promise<Record<string, string>> {
  const rules = (await config.headers!()) as Rule[];
  expect(rules).toHaveLength(1);
  expect(rules[0]?.source).toBe("/(.*)");
  return Object.fromEntries(rules[0]!.headers.map((h) => [h.key, h.value]));
}

// The test runs with NODE_ENV=test, which is not production, so the dev
// allowance applies here too. Production is asserted separately below.
const scriptSrc = "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

describe("security headers", () => {
  it("applies the full set to every path", async () => {
    expect(await headerMap()).toEqual({
      "Content-Security-Policy": `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests`,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy":
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), publickey-credentials-get=(self), publickey-credentials-create=(self)",
      "X-Frame-Options": "DENY",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Resource-Policy": "same-origin",
    });
  });

  it("does not let a script or a style come from anywhere but us", async () => {
    const csp = (await headerMap())["Content-Security-Policy"]!;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("object-src 'none'");
    // 'unsafe-inline' is still there for Next's own bootstrap script, and
    // 'strict-dynamic' would silently void it. See TECH-DEBT.md.
    expect(csp).not.toContain("strict-dynamic");
    expect(csp).not.toMatch(/script-src[^;]*https?:/);
  });

  it("allows eval only outside production", async () => {
    // React's development build needs it to rebuild stack traces; the
    // production bundle does not, and letting it through there would hand
    // an injected string a way to become code. The suite runs outside
    // production, so what is asserted here is the shape of the rule: the
    // allowance is present, and it is conditional on NODE_ENV rather than
    // written into the policy unconditionally.
    expect(process.env.NODE_ENV).not.toBe("production");
    expect((await headerMap())["Content-Security-Policy"]).toContain("'unsafe-eval'");
    const source = await readFile(new URL("../../next.config.ts", import.meta.url), "utf8");
    expect(source).toMatch(/NODE_ENV === "production"[\s\S]{0,120}unsafe-eval/);
  });

  it("still names the two permissions passkeys need", async () => {
    // A blanket deny added to this list later would switch off the login
    // without saying so, which is why they are written out.
    const policy = (await headerMap())["Permissions-Policy"]!;
    expect(policy).toContain("publickey-credentials-get=(self)");
    expect(policy).toContain("publickey-credentials-create=(self)");
  });
});
