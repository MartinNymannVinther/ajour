"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { weekNumberFromKey } from "@/core/dates";
import type { Subtask } from "@/core/db/schema";
import type { ProjectFull } from "@/modules/projects/types";
import { PEOPLE_LIST_ID } from "@/modules/projects/constants";
import {
  createMilestoneAction,
  deleteMilestoneAction,
  setMilestoneDoneAction,
  updateMilestoneAction,
} from "@/modules/projects/actions-milestones";
import {
  addDecisionAction,
  addExpenseAction,
  addObstacleAction,
  removeExpenseAction,
  removePersonAction,
  renamePersonAction,
  resolveObstacleAction,
  setBudgetAction,
  setRolesAction,
  updateExpenseAction,
  updateProjectMetaAction,
} from "@/modules/projects/actions-misc";
import {
  applyReplanAction,
  proposeReplanAction,
  takeSnapshotAction,
} from "@/modules/projects/actions-project";
import {
  createTaskAction,
  deleteTaskAction,
  moveTaskAction,
  relinkTaskAction,
  updateSubtasksAction,
  updateTaskPeopleAction,
} from "@/modules/projects/actions-tasks";
import { ChatPanel } from "./chat-panel";
import { DailyTip } from "./daily-tip";
import { EconomyCard } from "./economy-card";
import { MilestoneList } from "./milestone-list";
import { DecisionsCard } from "./decisions-card";
import { HistoryCard } from "./history-card";
import { ObstaclesCard } from "./obstacles-card";
import { PeopleCard } from "./people-card";
import { StatusesCard } from "./statuses-card";
import { useStateChange } from "./use-state-change";
import { OverviewTiles } from "./overview-tiles";
import { PlanCard } from "./plan-card";
import { ProjectHeader } from "./project-header";
import { ReplanBanner, type PendingReplan } from "./replan-banner";
import { TaskList } from "./task-list";
import { useProjectActions } from "./use-project-actions";

/**
 * One project, whole. The page is a server component; this holds the
 * state that spans the cards — which task is open, which view is chosen,
 * and the replan waiting for a yes — and hands every write to the
 * services through the actions.
 */
export function ProjectView({
  full,
  today,
  chatHistory,
}: {
  full: ProjectFull;
  today: string;
  chatHistory: Array<{ role: string; content: string; applied: unknown }>;
}) {
  const locale = useLocale();
  const common = useTranslations("common");
  const t = useTranslations("projects");
  const { run } = useProjectActions();
  const changeState = useStateChange(full.tasks, today, run);
  const [view, setView] = useState<"timeline" | "board">("timeline");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingReplan | null>(null);

  const { project, milestones, tasks, people, obstacles, decisions, expenses, snapshots } = full;
  const projectId = project.id;

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat(locale === "da" ? "da-DK" : "en-DK", {
      style: "currency",
      currency: "DKK",
      maximumFractionDigits: 0,
    }).format(amount);
  const weekLabel = (weekKey: string) => common("week", { number: weekNumberFromKey(weekKey) });

  const openTask = (id: string | null) => {
    setEditingTaskId(id);
    if (id)
      setTimeout(
        () =>
          document
            .getElementById(`task-${id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" }),
        60,
      );
  };

  const openMilestone = (id: string | null) => {
    setEditingMilestoneId(id);
    if (id)
      setTimeout(
        () =>
          document
            .getElementById(`milestone-${id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" }),
        60,
      );
  };

  /** Dragging a milestone asks what should follow; nothing moves yet. */
  const proposeReplan = (milestoneId: string, newDate: string, ripple = true) => {
    const milestone = milestones.find((m) => m.id === milestoneId);
    if (!milestone || newDate === milestone.date) return;
    setPending({
      milestone: { id: milestoneId, title: milestone.title, oldDate: milestone.date, newDate },
      proposal: null,
      loading: true,
      ripple,
    });
    void proposeReplanAction({ milestoneId, newDate, ripple }).then((result) => {
      setPending((p) =>
        p && p.milestone.id === milestoneId
          ? { ...p, proposal: result.ok ? result.data.proposal : null, loading: false }
          : p,
      );
    });
  };

  const approveReplan = () => {
    if (!pending?.proposal) return;
    const { milestone, proposal } = pending;
    run(
      () =>
        applyReplanAction({
          projectId,
          milestoneId: milestone.id,
          newDate: milestone.newDate,
          proposal,
        }),
      () => setPending(null),
    );
  };

  const peopleUsage = new Map<string, number>();
  for (const task of tasks) {
    if (task.ownerPersonId)
      peopleUsage.set(task.ownerPersonId, (peopleUsage.get(task.ownerPersonId) ?? 0) + 1);
    for (const id of task.participantIds) peopleUsage.set(id, (peopleUsage.get(id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <ProjectHeader
        project={project}
        shareLinks={full.shareLinks}
        onSaveRoles={(owner, manager) => run(() => setRolesAction({ projectId, owner, manager }))}
        onSaveMeta={(name, goal) => run(() => updateProjectMetaAction({ projectId, name, goal }))}
      />

      <OverviewTiles full={full} formatMoney={formatMoney} weekLabel={weekLabel} />

      <DailyTip projectId={projectId} />

      {pending && (
        <ReplanBanner
          pending={pending}
          onRipple={(ripple) =>
            proposeReplan(pending.milestone.id, pending.milestone.newDate, ripple)
          }
          onApprove={approveReplan}
          onCancel={() => setPending(null)}
        />
      )}

      <PlanCard
        projectId={projectId}
        today={today}
        view={view}
        onViewChange={setView}
        milestones={milestones}
        tasks={tasks}
        pendingMilestoneMove={
          pending ? { id: pending.milestone.id, newDate: pending.milestone.newDate } : null
        }
        onTaskMove={(id, startDate, endDate) =>
          run(() => moveTaskAction({ taskId: id, startDate, endDate }))
        }
        onTaskRelink={(id, milestoneId, startDate, endDate) =>
          run(() => relinkTaskAction({ taskId: id, milestoneId, startDate, endDate }))
        }
        onMilestoneMove={proposeReplan}
        onTaskClick={openTask}
        onMilestoneClick={openMilestone}
        onStateChange={changeState}
      />

      <datalist id={PEOPLE_LIST_ID}>
        {people.map((person) => (
          <option key={person.id} value={person.name} />
        ))}
      </datalist>

      <ChatPanel projectId={projectId} history={chatHistory} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <MilestoneList
            milestones={milestones}
            editingId={editingMilestoneId}
            onEdit={openMilestone}
            onSave={(input) =>
              run(
                () => updateMilestoneAction(input),
                () => setEditingMilestoneId(null),
              )
            }
            onToggleDone={(milestoneId, done) =>
              run(() => setMilestoneDoneAction({ milestoneId, done }))
            }
            onDelete={(milestoneId) => run(() => deleteMilestoneAction({ milestoneId }))}
            onCreate={async (title, date) => {
              let created: string | null = null;
              await run(
                () => createMilestoneAction({ projectId, title, date }),
                (id) => {
                  created = id;
                },
              );
              return created;
            }}
          />

          <TaskList
            today={today}
            boardMode={view === "board"}
            tasks={tasks}
            milestones={milestones}
            expenses={expenses}
            editingId={editingTaskId}
            formatMoney={formatMoney}
            onEdit={openTask}
            onStateChange={changeState}
            onSavePeople={(taskId, { dates, ...input }) =>
              run(
                () => updateTaskPeopleAction({ taskId, ...input }),
                () => {
                  setEditingTaskId(null);
                  // Typed dates go after the people, so the optimistic
                  // lock on the row is not tripped by our own first write.
                  if (dates) run(() => moveTaskAction({ taskId, ...dates }));
                },
              )
            }
            onSaveSubtasks={(taskId, subtasks: Subtask[]) =>
              run(() => updateSubtasksAction({ taskId, subtasks }))
            }
            onDelete={(taskId) =>
              run(
                () => deleteTaskAction({ taskId }),
                () => setEditingTaskId(null),
              )
            }
            onCreate={(input) => run(() => createTaskAction({ projectId, ...input }))}
          />
        </div>

        <div className="min-w-0 space-y-6">
          <EconomyCard
            budget={project.budget}
            expenses={expenses}
            tasks={tasks}
            formatMoney={formatMoney}
            onSetBudget={(budget) => run(() => setBudgetAction({ projectId, budget }))}
            onAddExpense={(input) => run(() => addExpenseAction({ projectId, ...input }))}
            onSetSpent={(expenseId, spent) => run(() => updateExpenseAction({ expenseId, spent }))}
            onRemoveExpense={(expenseId) => run(() => removeExpenseAction({ expenseId }))}
          />

          <ObstaclesCard
            obstacles={obstacles}
            onAdd={(title) => run(() => addObstacleAction({ projectId, title }))}
            onResolve={(obstacleId) => run(() => resolveObstacleAction({ obstacleId }))}
          />

          <DecisionsCard
            decisions={decisions}
            onAdd={(title, note) => run(() => addDecisionAction({ projectId, title, note }))}
          />

          <StatusesCard projectId={projectId} statuses={full.statusUpdates} weekLabel={weekLabel} />

          <PeopleCard
            people={people}
            usage={peopleUsage}
            onRename={(personId, name) =>
              run(() => renamePersonAction({ personId, name, projectId }))
            }
            onRemove={(personId) => run(() => removePersonAction({ personId, projectId }))}
          />

          <HistoryCard
            projectId={projectId}
            snapshots={snapshots}
            onCreate={(label) => run(() => takeSnapshotAction({ projectId, label }))}
          />
        </div>
      </div>

      <p className="text-meta text-center text-xs">{t("footerHint")}</p>
    </div>
  );
}
