import { env } from "@/core/env";
import { getLlmProvider } from "@/core/llm";
import { createLlmEngine, EngineUnavailable } from "./llm-engine";
import { rulesEngine, RULES_ENGINE_NAME } from "./rules-engine";
import type { AiEngine, EngineResult } from "./types";

export { rulesEngine, RULES_ENGINE_NAME, EngineUnavailable };
export type * from "./types";

/**
 * Which engine answers. The environment decides (LLM_PROVIDER), the
 * features just ask. With no provider the rules engine is the engine; with
 * one, it is the safety net: when the model does not answer, the rules
 * engine steps in and the result says so, so the interface can say so too.
 */
export function chosenEngine(): AiEngine {
  const provider = getLlmProvider();
  if (!provider) return rulesEngine;
  // Local models load slowly the first time; a hosted one answers in seconds.
  const timeoutMs = provider.id === "ollama" ? 240_000 : 60_000;
  return createLlmEngine(provider, timeoutMs);
}

/** True when a model is configured at all, for the settings page and the UI. */
export function modelConfigured(): boolean {
  return env.LLM_PROVIDER !== "none";
}

export async function withEngine<T>(
  fn: (engine: AiEngine) => Promise<T>,
): Promise<EngineResult<T>> {
  const engine = chosenEngine();
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
