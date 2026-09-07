"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/core/auth/guard";
import { LlmError } from "@/core/llm";
import {
  getModelSettings,
  saveModelSettings,
  SaveModelSettingsInput,
  workspaceLlmProvider,
  type ModelSettingsView,
} from "@/modules/ai/model-settings";
import { currentRole } from "@/modules/export/workspace";

export type LlmTestResult =
  | { status: "none" }
  | { status: "ok"; model: string; sample: string; ms: number }
  | {
      status: "failed";
      reason: "auth" | "unreachable" | "config" | "rate_limit" | "generic";
      detail: string;
    };

/**
 * Two steps, because they fail for different reasons and a person needs
 * to know which. First a token-free health check: is anything listening,
 * and does it have the model the workspace asked for. Then one real
 * completion, so the whole path — request, model, JSON parsing — is
 * proven rather than assumed.
 *
 * This exists because the settings page could otherwise say a model is
 * configured while every call quietly failed and the rules engine
 * answered. "Configured" and "working" are different claims, and only
 * one of them is worth making.
 */
export async function testLlmAction(): Promise<LlmTestResult> {
  const ctx = await requireOrgContext();
  if (!ctx) return { status: "failed", reason: "generic", detail: "unauthorized" };

  const provider = await workspaceLlmProvider(ctx);
  if (!provider) return { status: "none" };

  const health = await provider.healthCheck();
  if (!health.ok) return { status: "failed", reason: health.reason, detail: health.detail };

  const started = Date.now();
  try {
    const completion = await provider.complete(
      [{ role: "user", content: "Svar med præcis ét ord: OK" }],
      // Generous, because a local model that has not been asked anything
      // for a while reads itself off disk first, and that is not a fault.
      { maxTokens: 10, temperature: 0, timeoutMs: 120_000 },
    );
    return {
      status: "ok",
      model: completion.model,
      sample: completion.content.trim().slice(0, 80),
      ms: Date.now() - started,
    };
  } catch (error) {
    if (error instanceof LlmError) {
      const reason =
        error.reason === "auth"
          ? "auth"
          : error.reason === "unreachable"
            ? "unreachable"
            : error.reason === "rate_limit"
              ? "rate_limit"
              : "generic";
      return { status: "failed", reason, detail: error.message };
    }
    console.error("llm: test failed", error);
    return { status: "failed", reason: "generic", detail: "unexpected error" };
  }
}

export type SaveResult =
  | { ok: true; settings: ModelSettingsView }
  | { ok: false; error: "unauthorized" | "invalid" | "generic" };

/**
 * Owners and admins only. The model choice spends the workspace's money
 * and holds its key; a member who can edit tasks has no business changing
 * either, and the check lives here rather than in the form.
 */
export async function saveModelSettingsAction(input: unknown): Promise<SaveResult> {
  const ctx = await requireOrgContext();
  if (!ctx) return { ok: false, error: "unauthorized" };
  const role = await currentRole(ctx);
  if (role !== "owner" && role !== "admin") return { ok: false, error: "unauthorized" };

  const parsed = SaveModelSettingsInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    await saveModelSettings(ctx, parsed.data);
    revalidatePath("/settings/ai");
    return { ok: true, settings: await getModelSettings(ctx) };
  } catch (error) {
    console.error("llm: saving workspace model settings failed", error);
    return { ok: false, error: "generic" };
  }
}
