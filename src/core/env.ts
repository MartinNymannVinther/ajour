import { z } from "zod";

/**
 * Server-side environment variables, validated at the boundary.
 * Import this instead of reading process.env directly.
 */
export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_DATABASE_URL: z.url(),
    AUTH_DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(16),
    BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
    // LLM adapter (CLAUDE.md: EU-hosted or local models behind an
    // adapter): "mistral" (EU-hosted API), "ollama" (local or
    // self-hosted, Ollama-compatible) or "none" to disable AI features.
    LLM_PROVIDER: z.enum(["mistral", "ollama", "none"]).default("none"),
    // Secret. Lives only in .env locally and in Coolify in production.
    MISTRAL_API_KEY: z.string().min(1).optional(),
    // Model override; sensible per-provider defaults apply when unset.
    LLM_MODEL: z.string().min(1).optional(),
    OLLAMA_BASE_URL: z.url().default("http://localhost:11434"),
    // Who may create an account: "closed" (the default) admits nobody once
    // the first user exists, "open" lets anyone register. See
    // src/core/auth/signup.ts.
    SIGNUP: z.enum(["closed", "open"]).default("closed"),
    // A demo workspace per visitor, seeded and thrown away after a day.
    // Off by default: an installation running real work should not hand
    // out accounts, and the route answers 404 while this is "off".
    DEMO: z.enum(["off", "on"]).default("off"),
    // Outgoing mail (docs/adr/0013). An SMTP URL to a provider of the
    // installation's own choosing, e.g. smtps://user:pass@smtp.example.eu:465.
    // Unset: nothing is sent and the features that would send say so.
    SMTP_URL: z.string().min(1).optional(),
    MAIL_FROM: z.string().min(3).default("Ajour <ajour@localhost>"),
    // "memory" keeps mail in a list instead of sending it: tests, and a
    // developer without a mail account.
    MAIL_TRANSPORT: z.enum(["smtp", "memory"]).default("smtp"),
    // A shared secret for the scheduled endpoints (the status reminder),
    // sent as a bearer token by the scheduler. Unset: those endpoints
    // answer 404 and the scripts are the only way to run them.
    CRON_SECRET: z.string().min(16).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.LLM_PROVIDER === "mistral" && !value.MISTRAL_API_KEY) {
      ctx.addIssue({
        code: "custom",
        message: "LLM_PROVIDER=mistral requires MISTRAL_API_KEY",
        path: ["LLM_PROVIDER"],
      });
    }
  });

export const env = EnvSchema.parse(process.env);
