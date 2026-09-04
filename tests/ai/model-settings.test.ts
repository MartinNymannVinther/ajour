import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { env } from "@/core/env";
import { workspaceLlmSettings } from "@/core/db/schema";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import {
  getModelSettings,
  resolveLlmConfig,
  saveModelSettings,
  workspaceLlmProvider,
} from "@/modules/ai/model-settings";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";
import { eq } from "drizzle-orm";

/**
 * The workspace's own model. What matters is the order of inheritance —
 * the workspace wins, the installation is what it falls back to — and
 * that the key it hands us is not sitting in the table in the clear.
 *
 * The suite runs with LLM_PROVIDER=none, which is also the default for a
 * fresh installation, so "no installation model" is the starting point
 * these tests describe.
 */

let admin: Pool;
let a: OrgContext;
let b: OrgContext;

beforeAll(async () => {
  admin = adminPool();
  a = await seedWorkspace(admin, "llm_a");
  b = await seedWorkspace(admin, "llm_b");
});

afterAll(async () => {
  await admin.end();
});

describe("workspace model settings", () => {
  it("inherits the installation until the workspace chooses", async () => {
    const view = await getModelSettings(a);
    expect(view.choice).toBe("inherit");
    expect(view.effective.provider).toBe(env.LLM_PROVIDER);
    expect(await workspaceLlmProvider(a)).toBe(null);
  });

  it("lets a workspace choose a local model without touching the installation", async () => {
    await saveModelSettings(a, { provider: "ollama", model: "mistral-nemo", apiKey: "keep" });

    const view = await getModelSettings(a);
    expect(view.choice).toBe("ollama");
    expect(view.effective.model).toBe("mistral-nemo");
    const provider = await workspaceLlmProvider(a);
    expect(provider?.id).toBe("ollama");
    expect(provider?.model).toBe("mistral-nemo");

    // The neighbour is untouched: this is a per-workspace setting.
    expect((await getModelSettings(b)).choice).toBe("inherit");
  });

  it("falls back to the provider's default model when the field is left empty", async () => {
    await saveModelSettings(a, { provider: "ollama", model: "", apiKey: "keep" });
    expect((await workspaceLlmProvider(a))?.model).toBe("llama3.2");
  });

  it("stores a hosted key encrypted and never returns it", async () => {
    await saveModelSettings(a, {
      provider: "mistral",
      model: "mistral-large-latest",
      apiKey: "sk-workspace-secret-value",
    });

    const [row] = await withOrgContext(a, (tx) =>
      tx.select().from(workspaceLlmSettings).where(eq(workspaceLlmSettings.orgId, a.orgId)),
    );
    expect(row?.apiKeyCipher).toBeTruthy();
    expect(row!.apiKeyCipher).not.toContain("sk-workspace-secret-value");

    const view = await getModelSettings(a);
    expect(view.hasOwnKey).toBe(true);
    expect(view.effective.keyFrom).toBe("workspace");
    expect(JSON.stringify(view)).not.toContain("sk-workspace-secret-value");

    // The provider itself gets the real key back, decrypted.
    const config = await resolveLlmConfig(a);
    expect(config.apiKey).toBe("sk-workspace-secret-value");
  });

  it("keeps the key when only the model changes, and drops it on request", async () => {
    await saveModelSettings(a, {
      provider: "mistral",
      model: "mistral-small-latest",
      apiKey: "keep",
    });
    expect((await resolveLlmConfig(a)).apiKey).toBe("sk-workspace-secret-value");

    await saveModelSettings(a, {
      provider: "mistral",
      model: "mistral-small-latest",
      apiKey: "clear",
    });
    expect((await getModelSettings(a)).hasOwnKey).toBe(false);
  });

  it("never keeps a key for a provider that has none to use", async () => {
    await saveModelSettings(a, { provider: "mistral", model: "", apiKey: "sk-another-secret" });
    await saveModelSettings(a, { provider: "ollama", model: "", apiKey: "keep" });

    const [row] = await withOrgContext(a, (tx) =>
      tx.select().from(workspaceLlmSettings).where(eq(workspaceLlmSettings.orgId, a.orgId)),
    );
    expect(row?.apiKeyCipher).toBe(null);
  });

  it("goes back to inheriting, taking the stored row with it", async () => {
    await saveModelSettings(a, { provider: "mistral", model: "", apiKey: "sk-leftover-secret" });
    await saveModelSettings(a, { provider: "inherit", model: "", apiKey: "keep" });

    const rows = await withOrgContext(a, (tx) =>
      tx.select().from(workspaceLlmSettings).where(eq(workspaceLlmSettings.orgId, a.orgId)),
    );
    expect(rows).toHaveLength(0);
    expect((await getModelSettings(a)).choice).toBe("inherit");
  });

  it("records the change in the audit trail without the key", async () => {
    await saveModelSettings(a, { provider: "mistral", model: "", apiKey: "sk-audited-secret" });

    const { rows } = await admin.query(
      `select action, after_data from audit_log
       where entity_type = 'workspace_llm_settings' and org_id = $1
       order by created_at desc limit 1`,
      [a.orgId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toMatch(/^workspace_llm_settings\.(insert|update)$/);
    // Who changed the model is worth keeping; the key is not, and an
    // append-only log is the last place a secret should end up.
    expect(rows[0].after_data).not.toHaveProperty("api_key_cipher");
    expect(JSON.stringify(rows[0].after_data)).not.toContain("sk-audited-secret");
    expect(rows[0].after_data.provider).toBe("mistral");

    await saveModelSettings(a, { provider: "inherit", model: "", apiKey: "keep" });
  });

  it("a workspace that turns the model off gets the rules engine, not the installation's", async () => {
    await saveModelSettings(b, { provider: "none", model: "", apiKey: "keep" });
    expect(await workspaceLlmProvider(b)).toBe(null);
    expect((await getModelSettings(b)).effective.provider).toBe("none");
  });
});
