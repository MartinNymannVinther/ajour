import { addDaysIso, todayInCopenhagen } from "@/core/dates";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { createMilestone } from "@/modules/projects/write-milestones";
import {
  createTask,
  setTaskState,
  updateSubtasks,
  updateTaskPeople,
} from "@/modules/projects/write-tasks";
import {
  addDecision,
  addExpense,
  addObstacle,
  setBudget,
  setRoles,
} from "@/modules/projects/write-misc";
import { projects } from "@/core/db/schema";
import { recordEvent } from "@/modules/projects/events";

/**
 * The project a visitor lands in. It is deliberately half-finished: some
 * tasks running, one behind, an open obstacle, a decision already taken
 * and money partly spent, because a plan where everything is fine shows
 * nothing about what the tool is for.
 *
 * Built through the ordinary services rather than raw inserts, so the
 * demo cannot drift away from what the product actually does.
 */
export async function seedDemoProject(
  tx: AppTransaction,
  ctx: OrgContext,
  locale: "da" | "en",
): Promise<string> {
  const today = todayInCopenhagen();
  const day = (offset: number) => addDaysIso(today, offset);
  const words = locale === "da" ? DA : EN;

  const [project] = await tx
    .insert(projects)
    .values({
      orgId: ctx.orgId,
      name: words.name,
      description: words.description,
      goal: words.goal,
      templateKey: "event",
      createdBy: ctx.userId,
    })
    .returning({ id: projects.id });
  const projectId = project!.id;
  await recordEvent(tx, ctx, projectId, "project.created", { name: words.name });

  await setRoles(tx, ctx, projectId, "Lise", "Mette");
  await setBudget(tx, ctx, projectId, 60000);

  const milestones: string[] = [];
  for (const [i, m] of words.milestones.entries()) {
    milestones.push(
      await createMilestone(tx, ctx, {
        projectId,
        title: m.title,
        date: day(m.day),
        owner: m.owner,
        criterion: m.criterion,
        sort: i,
      }),
    );
  }

  const created: Record<string, string> = {};
  for (const task of words.tasks) {
    const id = await createTask(tx, ctx, {
      projectId,
      title: task.title,
      milestoneId: milestones[task.milestone] ?? null,
      owner: task.owner,
      startDate: day(task.start),
      endDate: day(task.end),
    });
    created[task.key] = id;
    if (task.state === "doing" || task.state === "done")
      await setTaskState(tx, ctx, id, task.state);
    if (task.participants?.length)
      await updateTaskPeople(tx, ctx, {
        taskId: id,
        owner: task.owner,
        participants: task.participants,
      });
    if (task.subtasks) await updateSubtasks(tx, ctx, id, task.subtasks);
  }

  await addExpense(tx, ctx, {
    projectId,
    title: words.expenses[0]!.title,
    amount: 15000,
    incurred: true,
    taskId: null,
  });
  await addExpense(tx, ctx, {
    projectId,
    title: words.expenses[1]!.title,
    amount: 30000,
    incurred: false,
    taskId: created.catering ?? null,
  });

  await addObstacle(tx, ctx, projectId, words.obstacle);
  await addDecision(tx, ctx, projectId, words.decision.title, words.decision.note);

  return projectId;
}

type Words = {
  name: string;
  description: string;
  goal: string;
  milestones: { title: string; day: number; owner: string; criterion: string }[];
  tasks: {
    key: string;
    title: string;
    milestone: number;
    owner: string;
    start: number;
    end: number;
    state?: "todo" | "doing" | "done";
    participants?: string[];
    subtasks?: { title: string; done: boolean }[];
  }[];
  expenses: { title: string }[];
  obstacle: string;
  decision: { title: string; note: string };
};

const DA: Words = {
  name: "Forårskonference (demo)",
  description:
    "Foreningen holder forårskonference for ca. 120 deltagere. Vi skal finde lokale, program, oplægsholdere og forplejning, og vi er fem frivillige om det.",
  goal: "En veloverstået konference med mindst 100 tilmeldte og et program der er på plads seks uger før.",
  milestones: [
    {
      title: "Lokale og dato låst",
      day: 18,
      owner: "Mette",
      criterion: "Kontrakt med lokalet er underskrevet, og datoen står i kalenderen.",
    },
    {
      title: "Program offentliggjort",
      day: 46,
      owner: "Jonas",
      criterion: "Programmet ligger på hjemmesiden, og tilmeldingen er åben.",
    },
    {
      title: "Konferencen afholdt",
      day: 74,
      owner: "Lise",
      criterion: "Dagen er gennemført med mindst 100 deltagere.",
    },
  ],
  tasks: [
    {
      key: "venues",
      title: "Indhent tilbud på tre lokaler",
      milestone: 0,
      owner: "Mette",
      start: -8,
      end: 2,
      state: "doing",
      subtasks: [
        { title: "Kulturhuset", done: true },
        { title: "Skolens aula", done: true },
        { title: "Idrætscentret", done: false },
      ],
    },
    { key: "book", title: "Vælg lokale og book", milestone: 0, owner: "Mette", start: 3, end: 16 },
    {
      key: "theme",
      title: "Fastlæg tema og spor",
      milestone: 1,
      owner: "Jonas",
      start: 4,
      end: 14,
      state: "doing",
    },
    {
      key: "speakers",
      title: "Kontakt og bekræft oplægsholdere",
      milestone: 1,
      owner: "Jonas",
      start: 15,
      end: 34,
      participants: ["Mette", "Sofie"],
    },
    {
      key: "signup",
      title: "Byg tilmeldingsside",
      milestone: 1,
      owner: "Sofie",
      start: 20,
      end: 30,
    },
    {
      key: "publish",
      title: "Udsend program og åbn tilmelding",
      milestone: 1,
      owner: "Sofie",
      start: 40,
      end: 45,
    },
    {
      key: "catering",
      title: "Bestil forplejning",
      milestone: 2,
      owner: "Karim",
      start: 47,
      end: 55,
    },
    {
      key: "runsheet",
      title: "Bemanding og drejebog for dagen",
      milestone: 2,
      owner: "Mette",
      start: 56,
      end: 68,
    },
    {
      key: "wrap",
      title: "Evaluér og saml op med bestyrelsen",
      milestone: 2,
      owner: "Lise",
      start: 76,
      end: 80,
    },
  ],
  expenses: [{ title: "Depositum til lokale" }, { title: "Forplejning (estimat)" }],
  obstacle: "Det store lokale er muligvis optaget i uge 43",
  decision: {
    title: "Konferencen holdes på en lørdag",
    note: "Flest frivillige og deltagere kan om lørdagen; besluttet på opstartsmødet.",
  },
};

const EN: Words = {
  name: "Spring conference (demo)",
  description:
    "The association is holding its spring conference for around 120 people. We need a venue, a programme, speakers and catering, and there are five of us doing it.",
  goal: "A conference that went well, with at least 100 people signed up and a programme settled six weeks out.",
  milestones: [
    {
      title: "Venue and date locked",
      day: 18,
      owner: "Mette",
      criterion: "The venue contract is signed and the date is in the calendar.",
    },
    {
      title: "Programme published",
      day: 46,
      owner: "Jonas",
      criterion: "The programme is on the website and sign-up is open.",
    },
    {
      title: "Conference held",
      day: 74,
      owner: "Lise",
      criterion: "The day happened, with at least 100 people there.",
    },
  ],
  tasks: [
    {
      key: "venues",
      title: "Get quotes from three venues",
      milestone: 0,
      owner: "Mette",
      start: -8,
      end: 2,
      state: "doing",
      subtasks: [
        { title: "The culture house", done: true },
        { title: "The school hall", done: true },
        { title: "The sports centre", done: false },
      ],
    },
    {
      key: "book",
      title: "Pick a venue and book it",
      milestone: 0,
      owner: "Mette",
      start: 3,
      end: 16,
    },
    {
      key: "theme",
      title: "Settle the theme and the tracks",
      milestone: 1,
      owner: "Jonas",
      start: 4,
      end: 14,
      state: "doing",
    },
    {
      key: "speakers",
      title: "Approach and confirm the speakers",
      milestone: 1,
      owner: "Jonas",
      start: 15,
      end: 34,
      participants: ["Mette", "Sofie"],
    },
    {
      key: "signup",
      title: "Build the sign-up page",
      milestone: 1,
      owner: "Sofie",
      start: 20,
      end: 30,
    },
    {
      key: "publish",
      title: "Send the programme out and open sign-up",
      milestone: 1,
      owner: "Sofie",
      start: 40,
      end: 45,
    },
    {
      key: "catering",
      title: "Order the catering",
      milestone: 2,
      owner: "Karim",
      start: 47,
      end: 55,
    },
    {
      key: "runsheet",
      title: "Staffing and a run sheet for the day",
      milestone: 2,
      owner: "Mette",
      start: 56,
      end: 68,
    },
    {
      key: "wrap",
      title: "Wrap up with the board",
      milestone: 2,
      owner: "Lise",
      start: 76,
      end: 80,
    },
  ],
  expenses: [{ title: "Venue deposit" }, { title: "Catering (estimate)" }],
  obstacle: "The big hall may already be booked in week 43",
  decision: {
    title: "The conference is held on a Saturday",
    note: "Most volunteers and most people can do Saturdays; decided at the kick-off.",
  },
};
