import { addDaysIso } from "@/core/dates";
import type { Locale, PlanProposal } from "@/modules/ai/types";

/**
 * Five starting points for the Start flow. A template is a finished plan
 * with dates counted from today, which the person adjusts and approves;
 * the description is prefilled so the AI can tailor it on request. The
 * content is product content in both languages, kept here rather than in
 * the UI catalogue because it becomes rows in a project.
 */

type Text = Record<Locale, string>;

export type ProjectTemplate = {
  id: string;
  name: Text;
  tagline: Text;
  description: Text;
  goal: Text;
  milestones: Array<{ title: Text; day: number }>;
  tasks: Array<{ title: Text; m: number; start: number; end: number }>;
};

const t = (da: string, en: string): Text => ({ da, en });

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "procurement",
    name: t("Anskaffelse", "Procurement"),
    tagline: t("Fra behov til valgt løsning i drift", "From need to chosen solution in use"),
    description: t(
      "Vi skal anskaffe en ny løsning. Behovet skal afdækkes hos dem der skal bruge den, vi skal indhente og sammenligne tilbud, vælge leverandør, forhandle aftalen på plads og tage løsningen i brug.",
      "We need to procure a new solution. The need has to be mapped with the people who will use it, we must gather and compare offers, choose a supplier, negotiate the agreement and take the solution into use.",
    ),
    goal: t(
      "Den rigtige løsning valgt på et oplyst grundlag, i drift til aftalt tid og pris.",
      "The right solution chosen on an informed basis, in use at the agreed time and price.",
    ),
    milestones: [
      { title: t("Behov og krav på plads", "Needs and requirements settled"), day: 21 },
      { title: t("Leverandør valgt", "Supplier chosen"), day: 49 },
      { title: t("Aftale underskrevet", "Agreement signed"), day: 63 },
      { title: t("Løsningen i brug", "Solution in use"), day: 91 },
    ],
    tasks: [
      {
        title: t(
          "Afdæk behovet hos dem der skal bruge løsningen",
          "Map the need with the people who will use the solution",
        ),
        m: 0,
        start: 1,
        end: 10,
      },
      {
        title: t(
          "Skriv kravene ned og prioritér dem",
          "Write down the requirements and prioritise them",
        ),
        m: 0,
        start: 8,
        end: 16,
      },
      {
        title: t("Afklar budgetramme og godkendelse", "Settle the budget frame and approval"),
        m: 0,
        start: 10,
        end: 18,
      },
      {
        title: t("Find og kontakt mulige leverandører", "Find and contact possible suppliers"),
        m: 1,
        start: 22,
        end: 32,
      },
      {
        title: t("Indhent og sammenlign tilbud", "Gather and compare offers"),
        m: 1,
        start: 33,
        end: 45,
      },
      {
        title: t("Se løsningerne demonstreret", "See the solutions demonstrated"),
        m: 1,
        start: 38,
        end: 46,
      },
      {
        title: t("Forhandl pris og vilkår", "Negotiate price and terms"),
        m: 2,
        start: 50,
        end: 58,
      },
      {
        title: t("Gennemgå og underskriv aftalen", "Review and sign the agreement"),
        m: 2,
        start: 59,
        end: 62,
      },
      {
        title: t("Planlæg ibrugtagning og oplæring", "Plan rollout and training"),
        m: 3,
        start: 64,
        end: 78,
      },
      {
        title: t("Tag løsningen i brug og saml op", "Take the solution into use and follow up"),
        m: 3,
        start: 80,
        end: 88,
      },
    ],
  },
  {
    id: "software",
    name: t("IT-udvikling", "Software development"),
    tagline: t(
      "Små etaper, tidlig afprøvning, rolig idriftsættelse",
      "Small steps, early testing, a calm launch",
    ),
    description: t(
      "Vi skal udvikle en IT-løsning. Den skal beskrives og godkendes, bygges i små etaper, afprøves af rigtige brugere og sættes i drift uden overraskelser til sidst.",
      "We are building a software solution. It has to be described and approved, built in small steps, tried by real users and launched without surprises at the end.",
    ),
    goal: t(
      "En løsning der virker hos brugerne, leveret i små etaper uden overraskelser til sidst.",
      "A solution that works for its users, delivered in small steps without surprises at the end.",
    ),
    milestones: [
      { title: t("Løsningen beskrevet og godkendt", "Solution described and approved"), day: 21 },
      {
        title: t("Første version klar til afprøvning", "First version ready for testing"),
        day: 56,
      },
      { title: t("Afprøvet og rettet til", "Tested and adjusted"), day: 77 },
      { title: t("I drift", "Live"), day: 91 },
    ],
    tasks: [
      {
        title: t(
          "Beskriv hvad løsningen skal kunne, og for hvem",
          "Describe what the solution must do, and for whom",
        ),
        m: 0,
        start: 1,
        end: 10,
      },
      {
        title: t(
          "Prioritér: hvad skal med først, hvad kan vente",
          "Prioritise: what comes first, what can wait",
        ),
        m: 0,
        start: 8,
        end: 14,
      },
      {
        title: t("Afklar teknik, drift og sikkerhed", "Settle technology, operations and security"),
        m: 0,
        start: 10,
        end: 18,
      },
      {
        title: t("Byg første version af kernen", "Build the first version of the core"),
        m: 1,
        start: 22,
        end: 42,
      },
      {
        title: t("Vis den frem undervejs og justér", "Show it along the way and adjust"),
        m: 1,
        start: 36,
        end: 52,
      },
      {
        title: t("Lad rigtige brugere afprøve den", "Let real users try it"),
        m: 2,
        start: 57,
        end: 68,
      },
      {
        title: t("Ret det vigtigste fra afprøvningen", "Fix the most important findings"),
        m: 2,
        start: 64,
        end: 75,
      },
      {
        title: t("Gør drift, backup og support klar", "Get operations, backup and support ready"),
        m: 3,
        start: 74,
        end: 82,
      },
      { title: t("Sæt i drift", "Go live"), m: 3, start: 84, end: 90 },
      {
        title: t("Følg op med brugerne efter idriftsættelse", "Follow up with users after launch"),
        m: 3,
        start: 93,
        end: 100,
      },
    ],
  },
  {
    id: "event",
    name: t("Arrangement", "Event"),
    tagline: t("Konference, fest eller generalforsamling", "Conference, party or general assembly"),
    description: t(
      "Vi skal holde et arrangement. Sted og dato skal på plads, programmet skal lægges, tilmeldingen skal åbnes, og praktikken på dagen skal fungere.",
      "We are holding an event. Venue and date must be settled, the programme planned, registration opened, and the practicalities on the day must work.",
    ),
    goal: t(
      "Et veloverstået arrangement hvor rammer, program og praktik er på plads i god tid.",
      "A successful event with venue, programme and practicalities in place well ahead of time.",
    ),
    milestones: [
      { title: t("Dato og sted låst", "Date and venue locked"), day: 21 },
      { title: t("Program og tilmelding klar", "Programme and registration ready"), day: 49 },
      { title: t("Arrangementet afholdt", "Event held"), day: 77 },
    ],
    tasks: [
      {
        title: t(
          "Fastlæg formål, målgruppe og budgetramme",
          "Settle purpose, audience and budget frame",
        ),
        m: 0,
        start: 1,
        end: 8,
      },
      {
        title: t("Find og book sted og dato", "Find and book venue and date"),
        m: 0,
        start: 6,
        end: 18,
      },
      {
        title: t(
          "Læg programmet og lav aftaler med de medvirkende",
          "Plan the programme and confirm the contributors",
        ),
        m: 1,
        start: 22,
        end: 40,
      },
      {
        title: t("Åbn tilmeldingen og invitér", "Open registration and invite"),
        m: 1,
        start: 36,
        end: 46,
      },
      {
        title: t("Bestil forplejning og praktik", "Order catering and practicalities"),
        m: 2,
        start: 50,
        end: 62,
      },
      {
        title: t(
          "Lav drejebog og fordel rollerne på dagen",
          "Write the run sheet and assign roles for the day",
        ),
        m: 2,
        start: 60,
        end: 70,
      },
      {
        title: t("Saml op med holdet efter arrangementet", "Debrief with the team after the event"),
        m: 2,
        start: 80,
        end: 84,
      },
    ],
  },
  {
    id: "tasklist",
    name: t("Opgavesamling", "Task collection"),
    tagline: t("Mange små opgaver samlet ét sted", "Many small tasks in one place"),
    description: t(
      "Vi har en bunke mindre opgaver, der skal samles ét sted med ansvar og deadline på hver, så de faktisk bliver lukket.",
      "We have a pile of smaller tasks that need to be gathered in one place with an owner and a deadline on each, so they actually get closed.",
    ),
    goal: t(
      "De løse opgaver samlet ét sted, med ansvar og deadline på hver, så de bliver lukket.",
      "The loose tasks gathered in one place, with an owner and a deadline on each, so they get closed.",
    ),
    milestones: [
      { title: t("Listen komplet og prioriteret", "List complete and prioritised"), day: 7 },
      { title: t("Halvvejs", "Halfway"), day: 42 },
      { title: t("Alle opgaver lukket", "All tasks closed"), day: 84 },
    ],
    tasks: [
      {
        title: t(
          "Saml alle opgaverne ind og skriv dem på listen",
          "Collect all the tasks and put them on the list",
        ),
        m: 0,
        start: 1,
        end: 5,
      },
      {
        title: t(
          "Sæt ansvarlig og deadline på hver opgave",
          "Put an owner and a deadline on each task",
        ),
        m: 0,
        start: 4,
        end: 7,
      },
      { title: t("Opgave 1 (omdøb mig)", "Task 1 (rename me)"), m: 1, start: 8, end: 18 },
      { title: t("Opgave 2 (omdøb mig)", "Task 2 (rename me)"), m: 1, start: 15, end: 28 },
      { title: t("Opgave 3 (omdøb mig)", "Task 3 (rename me)"), m: 2, start: 25, end: 42 },
      { title: t("Opgave 4 (omdøb mig)", "Task 4 (rename me)"), m: 2, start: 40, end: 70 },
    ],
  },
  {
    id: "solo",
    name: t("Enkeltmandsprojekt", "Solo project"),
    tagline: t("Et projekt du driver alene", "A project you run alone"),
    description: t(
      "Et projekt jeg driver alene. Arbejdet skal deles op i overskuelige bidder, og planen skal holde mig ærlig undervejs.",
      "A project I run alone. The work has to be split into manageable pieces, and the plan has to keep me honest along the way.",
    ),
    goal: t(
      "Et projekt du driver alene, med en plan der holder dig ærlig undervejs.",
      "A project you run alone, with a plan that keeps you honest along the way.",
    ),
    milestones: [
      { title: t("Klar til at gå i gang", "Ready to start"), day: 7 },
      { title: t("Halvvejs og stadig på sporet", "Halfway and still on track"), day: 35 },
      { title: t("Færdigt og afleveret", "Done and delivered"), day: 70 },
    ],
    tasks: [
      {
        title: t(
          "Beskriv målet, og hvad færdigt betyder",
          "Describe the goal, and what done means",
        ),
        m: 0,
        start: 1,
        end: 3,
      },
      {
        title: t(
          "Del arbejdet op i bidder på højst en uge",
          "Split the work into pieces of a week at most",
        ),
        m: 0,
        start: 2,
        end: 5,
      },
      { title: t("Første arbejdsbid", "First piece of work"), m: 1, start: 8, end: 14 },
      { title: t("Anden arbejdsbid", "Second piece of work"), m: 1, start: 15, end: 24 },
      { title: t("Tredje arbejdsbid", "Third piece of work"), m: 2, start: 29, end: 42 },
      {
        title: t("Gennemgå det hele med friske øjne", "Review everything with fresh eyes"),
        m: 2,
        start: 43,
        end: 49,
      },
      { title: t("Aflevér og saml op", "Deliver and follow up"), m: 2, start: 50, end: 56 },
    ],
  },
];

export function buildTemplate(
  template: ProjectTemplate,
  today: string,
  locale: Locale,
): PlanProposal {
  return {
    name: template.name[locale],
    goal: template.goal[locale],
    budget: null,
    milestones: template.milestones.map((m) => ({
      title: m.title[locale],
      date: addDaysIso(today, m.day),
    })),
    tasks: template.tasks.map((task) => ({
      title: task.title[locale],
      milestoneIndex: task.m,
      owner: "",
      startDate: addDaysIso(today, task.start),
      endDate: addDaysIso(today, task.end),
    })),
  };
}

export function findTemplate(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((template) => template.id === id);
}
