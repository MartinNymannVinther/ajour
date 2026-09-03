"use server";

import { z } from "zod";
import { action, NotFound } from "./action-helpers";
import {
  BudgetSchema,
  NewDecisionSchema,
  NewExpenseSchema,
  NewObstacleSchema,
  ProjectMetaSchema,
  RolesSchema,
  amount,
  id,
  name,
} from "./validation";
import { renamePerson, removePerson } from "./people";
import {
  addDecision,
  addExpense,
  addObstacle,
  removeExpense,
  resolveObstacle,
  setBudget,
  setRoles,
  updateExpense,
  updateProjectMeta,
} from "./write-misc";
import type { Result } from "./types";

/**
 * Obstacles, decisions, money, roles and the people register. Small
 * things, all of which the AI can also do from the chat — through the
 * same services, so the rules cannot differ between the two paths.
 */

const found = <T>(row: T | null): T => {
  if (row === null) throw new NotFound();
  return row;
};

export async function addObstacleAction(raw: unknown): Promise<Result<string>> {
  return action(NewObstacleSchema, raw, (tx, ctx, input) =>
    addObstacle(tx, ctx, input.projectId, input.title),
  );
}

export async function resolveObstacleAction(raw: unknown): Promise<Result<string>> {
  return action(z.object({ obstacleId: id }), raw, async (tx, ctx, input) => {
    const o = found(await resolveObstacle(tx, ctx, input.obstacleId));
    return o.projectId;
  });
}

export async function addDecisionAction(raw: unknown): Promise<Result<string>> {
  return action(NewDecisionSchema, raw, (tx, ctx, input) =>
    addDecision(tx, ctx, input.projectId, input.title, input.note),
  );
}

export async function setBudgetAction(raw: unknown): Promise<Result<undefined>> {
  return action(BudgetSchema, raw, async (tx, ctx, input) => {
    found(await setBudget(tx, ctx, input.projectId, input.budget));
    return undefined;
  });
}

export async function addExpenseAction(raw: unknown): Promise<Result<string>> {
  return action(NewExpenseSchema, raw, (tx, ctx, input) => addExpense(tx, ctx, input));
}

export async function updateExpenseAction(raw: unknown): Promise<Result<string>> {
  return action(
    z.object({ expenseId: id, incurred: z.boolean().optional(), amount: amount.optional() }),
    raw,
    async (tx, ctx, input) => {
      const e = found(
        await updateExpense(tx, ctx, input.expenseId, {
          incurred: input.incurred,
          amount: input.amount,
        }),
      );
      return e.projectId;
    },
  );
}

export async function removeExpenseAction(raw: unknown): Promise<Result<string>> {
  return action(z.object({ expenseId: id }), raw, async (tx, ctx, input) => {
    const e = found(await removeExpense(tx, ctx, input.expenseId));
    return e.projectId;
  });
}

export async function setRolesAction(raw: unknown): Promise<Result<undefined>> {
  return action(RolesSchema, raw, async (tx, ctx, input) => {
    found(await setRoles(tx, ctx, input.projectId, input.owner, input.manager));
    return undefined;
  });
}

export async function updateProjectMetaAction(raw: unknown): Promise<Result<undefined>> {
  return action(ProjectMetaSchema, raw, async (tx, ctx, input) => {
    found(
      await updateProjectMeta(tx, ctx, input.projectId, { name: input.name, goal: input.goal }),
    );
    return undefined;
  });
}

export async function renamePersonAction(raw: unknown): Promise<Result<undefined>> {
  return action(
    z.object({ personId: id, name: name.min(1), projectId: id }),
    raw,
    async (tx, ctx, input) => {
      if (!(await renamePerson(tx, ctx, input.personId, input.name))) throw new NotFound();
      return undefined;
    },
  );
}

export async function removePersonAction(raw: unknown): Promise<Result<undefined>> {
  return action(z.object({ personId: id, projectId: id }), raw, async (tx, ctx, input) => {
    if (!(await removePerson(tx, ctx, input.personId))) throw new NotFound();
    return undefined;
  });
}
