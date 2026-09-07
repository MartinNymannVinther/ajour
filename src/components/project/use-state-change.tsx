"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { TaskState } from "@/core/db/schema";
import { formatDateDa, maxIso } from "@/core/dates";
import { moveTaskAction, setTaskStateAction } from "@/modules/projects/actions-tasks";
import type { TaskView } from "@/modules/projects/types";
import type { Run } from "./use-project-actions";

/**
 * Changing a task's state, with the one follow-up question worth asking:
 * a task set to "in progress" today that was planned to start on another
 * day has, in fact, started today. The system asks rather than decides,
 * because sometimes the date is right and the click was late.
 */
export function useStateChange(tasks: TaskView[], today: string, run: Run) {
  const t = useTranslations("projects.tasks.startToday");

  return (taskId: string, state: TaskState) => {
    const task = tasks.find((x) => x.id === taskId);
    return run(
      () => setTaskStateAction({ taskId, state }),
      () => {
        if (state !== "doing" || !task || task.startDate === today) return;
        // A custom toast, so the question and its two answers stack:
        // sonner's own action slot squeezes a sentence this long into a
        // column beside the buttons.
        toast.custom(
          (id) => (
            <div className="bg-popover text-popover-foreground border-border w-[356px] rounded-md border p-4 shadow-lg">
              <p className="text-sm font-medium">
                {t("question", { date: formatDateDa(task.startDate) })}
              </p>
              <p className="text-meta mt-1 text-xs">{t("hint")}</p>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    toast.dismiss(id);
                    void run(() =>
                      moveTaskAction({
                        taskId,
                        startDate: today,
                        // A task cannot end before it starts; a one-day
                        // task moved forward becomes a one-day task today.
                        endDate: maxIso([task.endDate, today]),
                      }),
                    );
                  }}
                >
                  {t("move")}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => toast.dismiss(id)}>
                  {t("keep")}
                </Button>
              </div>
            </div>
          ),
          { duration: 15_000 },
        );
      },
    );
  };
}
