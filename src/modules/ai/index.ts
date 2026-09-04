import type { OrgContext } from "@/core/db/tenant";
import { createLlmEngine, EngineUnavailable } from "./llm-engine";
import { workspaceLlmProvider } from "./model-settings";
import { rulesEngine, RULES_ENGINE_NAME } from "./rules-engine";
import type { AiEngine, EngineResult } from "./types";

export { rulesEngine, RULES_ENGINE_NAME, EngineUnavailable };
export type * from "./types";

/**
 * Which engine answers. The workspace decides, falling back to the
 * installation's .env when it has made no choice; the features just ask.
 * With no provider the rules engine is the engine; with one, it is the
 * safety net: when the model does not answer, the rules engine steps in
 * and the result says so, so the interface can say so too.
 */
export async function chosenEngine(ctx: OrgContext): Promise<AiEngine> {
  const provider = await workspaceLlmProvider(ctx);
  if (!provider) return rulesEngine;
  // Local models load slowly the first time; a hosted one answers in seconds.
  const timeoutMs = provider.id === "ollama" ? 240_000 : 60_000;
  return createLlmEngine(provider, timeoutMs);
}

/** True when a model is configured for this workspace, for the UI. */
export async function modelConfigured(ctx: OrgContext): Promise<boolean> {
  return (await workspaceLlmProvider(ctx)) !== null;
}

export async function withEngine<T>(
  ctx: OrgContext,
  fn: (engine: AiEngine) => Promise<T>,
): Promise<EngineResult<T>> {
  const engine = await chosenEngine(ctx);
  try {
    const result = await fn(engine);
    return { result, engine: engine.name, fallback: false };
  } catch (error) {
    if (engine === rulesEngine) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`ai: ${engine.name} did not answer, using the rules engine: ${reason}`);
    const result = await fn(rulesEngine);
    return {
      result,
      engine: RULES_ENGINE_NAME,
      fallback: true,
      fallbackReason: reason.slice(0, 300),
    };
  }
}
