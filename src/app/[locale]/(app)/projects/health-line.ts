import type { ProjectHealth } from "@/modules/projects/health";

type T = (key: string, values?: Record<string, string | number>) => string;

/**
 * The reasons behind a project's colour as one short line: the two
 * heaviest, in the reader's language. An all-clear project says so.
 */
export function healthLine(health: ProjectHealth, t: T): string {
  if (health.reasons.length === 0) return t(`level.${health.level}`);
  return health.reasons
    .slice(0, 2)
    .map((reason) => {
      switch (reason.kind) {
        case "overdueTasks":
          return t("overdueTasks", { count: reason.count });
        case "passedMilestones":
          return t("passedMilestones", { count: reason.count });
        case "milestoneSoon":
          return t("milestoneSoon", { title: reason.title, days: reason.days, open: reason.open });
        case "openObstacles":
          return t("openObstacles", { count: reason.count });
        case "overBudget":
          return t("overBudget");
        case "noStatus":
          return reason.days === null ? t("noStatusYet") : t("noStatus", { days: reason.days });
        case "noOwner":
          return t("noOwner", { count: reason.count });
      }
    })
    .join(" · ");
}
