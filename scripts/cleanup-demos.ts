import { cleanupExpiredDemos, demoEnabled } from "../src/modules/demo/service";

/**
 * Deletes expired demo workspaces. The app does this on each visit, so
 * this script is for an installation that wants it on a timer instead —
 * a cron entry, or a Coolify scheduled task:
 *
 *   pnpm tsx scripts/cleanup-demos.ts
 */
async function main() {
  if (!demoEnabled()) {
    console.log("cleanup-demos: DEMO is off, nothing to do");
    return;
  }
  const removed = await cleanupExpiredDemos();
  console.log(`cleanup-demos: removed ${removed} expired demo workspace(s)`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("cleanup-demos: failed", error);
    process.exit(1);
  });
