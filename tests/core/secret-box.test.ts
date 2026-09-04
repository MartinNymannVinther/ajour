import { describe, expect, it } from "vitest";
import { openSecret, sealSecret, secretHint } from "@/core/crypto/secret-box";

/**
 * The box that holds a workspace's model key. Three claims worth proving:
 * a sealed value comes back, a tampered one does not come back at all
 * rather than coming back wrong, and anything unreadable reads as absent
 * so an installation survives a rotated auth secret.
 */
describe("secret box", () => {
  it("returns what was sealed", () => {
    const sealed = sealSecret("sk-test-abcdef123456");
    expect(sealed).not.toContain("sk-test");
    expect(openSecret(sealed)).toBe("sk-test-abcdef123456");
  });

  it("gives a different ciphertext every time, so equal keys do not look equal", () => {
    expect(sealSecret("same")).not.toBe(sealSecret("same"));
  });

  it("refuses a tampered ciphertext instead of returning something wrong", () => {
    const parts = sealSecret("sk-test-abcdef123456").split(".");
    const flipped = Buffer.from(parts[3]!, "base64url");
    flipped[0] = flipped[0]! ^ 0xff;
    expect(
      openSecret([parts[0], parts[1], parts[2], flipped.toString("base64url")].join(".")),
    ).toBe(null);
  });

  it("treats nonsense, an unknown version and nothing at all as no key", () => {
    expect(openSecret(null)).toBe(null);
    expect(openSecret("")).toBe(null);
    expect(openSecret("not-a-sealed-value")).toBe(null);
    expect(openSecret(`v2.${"a".repeat(16)}.${"b".repeat(22)}.${"c".repeat(8)}`)).toBe(null);
  });

  it("hints at a key without showing it", () => {
    expect(secretHint("sk-abcdefgh1234")).toBe("····1234");
    expect(secretHint("ab")).toBe("····");
  });
});
