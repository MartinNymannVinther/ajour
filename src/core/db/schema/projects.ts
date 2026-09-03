import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { domainId, organizations, users } from "./foundation";

/**
 * The product's data model: the seven concepts the vision allows (project,
 * milestone, task, decision, obstacle, status, budget line) plus what
 * running them for real needs — people as identities, an event log,
 * snapshots and the daily tip.
 *
 * Every table carries `org_id` with a cascading foreign key to the
 * workspace, so deleting a workspace deletes everything it owns, and RLS
 * keys on the same column. Dates are ISO strings (yyyy-mm-dd) in
 * Europe/Copenhagen; instants are timestamptz.
 */

const tenant = () =>
  text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" });

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * A person in the workspace's resource pool. Identity rather than free
 * text: the same person on ten tasks is one row, can be renamed once, and
 * can later be linked to a user account (`user_id`) when they log in.
 */
export const people = pgTable(
  "people",
  {
    id: domainId("id"),
    orgId: tenant(),
    name: text("name").notNull(),
    email: text("email"),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("people_org_name_uq").on(t.orgId, sql`lower(${t.name})`),
    index("people_org_idx").on(t.orgId),
  ],
);

export const TASK_STATES = ["todo", "doing", "done"] as const;
export type TaskState = (typeof TASK_STATES)[number];

export const MILESTONE_RELATIONS = ["before", "after"] as const;
export type MilestoneRelation = (typeof MILESTONE_RELATIONS)[number];

export const OBSTACLE_STATUSES = ["open", "critical", "resolved"] as const;
export type ObstacleStatus = (typeof OBSTACLE_STATUSES)[number];

export type Subtask = { title: string; done: boolean };

export const projects = pgTable(
  "projects",
  {
    id: domainId("id"),
    orgId: tenant(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    goal: text("goal").notNull().default(""),
    ownerPersonId: text("owner_person_id").references(() => people.id, { onDelete: "set null" }),
    managerPersonId: text("manager_person_id").references(() => people.id, {
      onDelete: "set null",
    }),
    /** Whole kroner; null means the project does not track money. */
    budget: integer("budget"),
    /** Template the plan started from, for the record. */
    templateKey: text("template_key"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("projects_org_created_idx").on(t.orgId, t.createdAt)],
);

export const milestones = pgTable(
  "milestones",
  {
    id: domainId("id"),
    orgId: tenant(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    doneAt: timestamp("done_at", { withTimezone: true }),
    ownerPersonId: text("owner_person_id").references(() => people.id, { onDelete: "set null" }),
    /** "True when …": the one acceptance criterion. */
    criterion: text("criterion").notNull().default(""),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("milestones_project_idx").on(t.projectId, t.date)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: domainId("id"),
    orgId: tenant(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    milestoneId: text("milestone_id").references(() => milestones.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    ownerPersonId: text("owner_person_id").references(() => people.id, { onDelete: "set null" }),
    /** before = leads up to its milestone, after = follows it. */
    milestoneRelation: text("milestone_relation").notNull().default("before"),
    state: text("state").notNull().default("todo"),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    subtasks: jsonb("subtasks").$type<Subtask[]>().notNull().default([]),
    ...timestamps,
  },
  (t) => [
    index("tasks_project_idx").on(t.projectId, t.startDate),
    index("tasks_milestone_idx").on(t.milestoneId),
  ],
);

/** The other people on a task; the owner is a column on the task. */
export const taskParticipants = pgTable(
  "task_participants",
  {
    orgId: tenant(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.personId] })],
);

export const obstacles = pgTable(
  "obstacles",
  {
    id: domainId("id"),
    orgId: tenant(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    note: text("note").notNull().default(""),
    status: text("status").notNull().default("open"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("obstacles_project_idx").on(t.projectId, t.createdAt)],
);

export const decisions = pgTable(
  "decisions",
  {
    id: domainId("id"),
    orgId: tenant(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    note: text("note").notNull().default(""),
    /** user | ai — who wrote it down; a person always said yes first. */
    source: text("source").notNull().default("user"),
    ...timestamps,
  },
  (t) => [index("decisions_project_idx").on(t.projectId, t.createdAt)],
);

/** A budget line: expected until the money is spent, then incurred. */
export const expenses = pgTable(
  "expenses",
  {
    id: domainId("id"),
    orgId: tenant(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    /** Whole kroner. */
    amount: integer("amount").notNull(),
    incurred: boolean("incurred").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("expenses_project_idx").on(t.projectId, t.createdAt)],
);

/**
 * The weekly status. `details` is the report frozen at approval so the PDF
 * says the same thing next year as it did the day it was shared.
 */
export const statusUpdates = pgTable(
  "status_updates",
  {
    id: domainId("id"),
    orgId: tenant(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** ISO week key, e.g. 2026-W37; the label is rendered per locale. */
    weekKey: text("week_key").notNull(),
    text: text("text").notNull(),
    questions: jsonb("questions").$type<string[]>().notNull().default([]),
    details: jsonb("details").$type<Record<string, unknown>>(),
    engine: text("engine").notNull().default(""),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: text("approved_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("status_updates_project_idx").on(t.projectId, t.createdAt)],
);

/** A copy of the plan, taken before anything that should be undoable. */
export const snapshots = pgTable(
  "snapshots",
  {
    id: domainId("id"),
    orgId: tenant(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    /** user | ai | system — what took the copy. */
    reason: text("reason").notNull().default("user"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("snapshots_project_idx").on(t.projectId, t.createdAt)],
);

/** One tip per project per day, so a page view never costs a model call. */
export const tips = pgTable(
  "tips",
  {
    id: domainId("id"),
    orgId: tenant(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    title: text("title").notNull(),
    text: text("text").notNull(),
    action: text("action").notNull().default(""),
    engine: text("engine").notNull().default(""),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tips_project_day_uq").on(t.projectId, t.day)],
);

/**
 * What happened in a project, as structured facts: a type and a payload,
 * rendered into sentences in the reader's language. The AI reads the same
 * facts, so nothing in the data layer is tied to Danish.
 */
export const events = pgTable(
  "events",
  {
    id: domainId("id"),
    orgId: tenant(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    /** user | ai | system */
    actorKind: text("actor_kind").notNull().default("user"),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_project_idx").on(t.projectId, t.createdAt)],
);

export type Person = typeof people.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Milestone = typeof milestones.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Obstacle = typeof obstacles.$inferSelect;
export type Decision = typeof decisions.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type StatusUpdate = typeof statusUpdates.$inferSelect;
export type Snapshot = typeof snapshots.$inferSelect;
export type Tip = typeof tips.$inferSelect;
export type ProjectEvent = typeof events.$inferSelect;
