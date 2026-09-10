/**
 * Runs once when the server starts, before it accepts a request.
 *
 * The one job here is to make a bad environment fail loudly. Next's
 * standalone server loads route modules lazily, so without this, a
 * variable that fails validation does not stop the server from starting;
 * it turns into a 500 on the first request that happens to import
 * `@/core/env`, and every request after it. The container reports "Up",
 * the health check reports 500, and the cause is nowhere near either of
 * those words.
 *
 * That is exactly how the first deployment went. Importing the module
 * here moves the failure to boot. Next itself only logs a failed hook
 * and carries on serving 500s, which is the same silence with a better
 * log line, so the exit is ours: print the zod message and stop the
 * process. Docker then restarts it, the container shows as restarting
 * rather than up, and the message is the last thing in the log.
 *
 * Node runtime only: the edge runtime cannot import pg, and there is no
 * edge runtime in this app anyway.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    await import("@/core/env");
  } catch (error) {
    console.error("ajour: refusing to start, the environment is not valid.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
