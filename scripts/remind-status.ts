import "dotenv/config";
import { sendStatusReminders } from "../src/modules/reports/reminder";

/**
 * Sends the weekly status reminder once. Meant for cron on the server
 * (docs/deploy.md); safe to run twice, because a project reminded this
 * week is not reminded again.
 */
sendStatusReminders()
  .then((outcome) => {
    console.log(
      outcome.skipped === "notConfigured"
        ? "remind-status: SMTP_URL is not set, nothing sent"
        : `remind-status: ${outcome.mails} mails for ${outcome.projects} projects in ${outcome.workspaces} workspaces`,
    );
    process.exit(0);
  })
  .catch((error) => {
    console.error("remind-status failed", error);
    process.exit(1);
  });
