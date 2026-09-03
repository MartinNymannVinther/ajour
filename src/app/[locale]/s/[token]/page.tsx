import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Timeline } from "@/components/project/timeline";
import { HaijMark, PRODUCT_NAME } from "@/components/wordmark";
import { formatDateDa, todayInCopenhagen, weekNumberFromKey } from "@/core/dates";
import { readSharedProject } from "@/modules/share/service";

type Params = { params: Promise<{ token: string }> };

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * The shared status page. No login, no session, no workspace: the token
 * in the URL opens one project's read, and that read is a separate,
 * minimal query — it cannot reach the budget, the obstacles, the drafts
 * or the chat, whatever this page were to ask for.
 */
export default async function SharedProjectPage({ params }: Params) {
  const { token } = await params;
  const today = todayInCopenhagen();
  const shared = await readSharedProject(token, today);
  if (!shared) notFound();
  const t = await getTranslations("share");
  const common = await getTranslations("common");

  const done = shared.tasks.filter((task) => task.state === "done").length;
  const nextMilestone =
    shared.milestones.filter((m) => !m.done).sort((a, b) => a.date.localeCompare(b.date))[0] ??
    null;
  const [latest, ...earlier] = shared.statuses;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <header>
        <p className="text-label text-xs tracking-wide uppercase">{t("kicker")}</p>
        <h1 className="font-heading mt-1 text-2xl font-semibold">{shared.name}</h1>
        {shared.goal && <p className="text-meta mt-1 text-sm">{shared.goal}</p>}
        <p className="text-meta mt-2 text-xs">
          {t("progress", { done, total: shared.tasks.length })}
          {nextMilestone
            ? ` · ${t("nextMilestone", {
                title: nextMilestone.title,
                date: formatDateDa(nextMilestone.date),
              })}`
            : ""}
        </p>
      </header>

      {latest ? (
        <section className="border-border bg-card rounded-xl border p-5">
          <h2 className="font-heading text-sm font-semibold">
            {common("week", { number: weekNumberFromKey(latest.weekKey) })}
          </h2>
          <p className="text-label mt-0.5 text-xs">
            {formatDateDa(latest.approvedAt.toISOString().slice(0, 10))}
          </p>
          <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-line">{latest.text}</p>
        </section>
      ) : (
        <section className="border-border text-meta rounded-xl border border-dashed p-5 text-sm">
          {t("noStatus")}
        </section>
      )}

      <section>
        <h2 className="text-meta mb-2 text-sm font-semibold tracking-wide uppercase">
          {t("planNow")}
        </h2>
        <Timeline
          today={today}
          compact
          milestones={shared.milestones.map((m) => ({
            id: m.id,
            title: m.title,
            date: m.date,
            doneAt: m.done ? new Date() : null,
          }))}
          tasks={shared.tasks.map((task) => ({
            id: task.id,
            title: task.title,
            ownerName: "",
            state: task.state,
            startDate: task.startDate,
            endDate: task.endDate,
            milestoneId: task.milestoneId,
            participants: [],
          }))}
        />
      </section>

      {earlier.length > 0 && (
        <section>
          <h2 className="text-meta mb-2 text-sm font-semibold tracking-wide uppercase">
            {t("earlier")}
          </h2>
          <ul className="space-y-2">
            {earlier.map((status) => (
              <li key={status.id} className="border-border bg-card rounded-xl border p-4">
                <p className="text-sm font-medium">
                  {common("week", { number: weekNumberFromKey(status.weekKey) })}{" "}
                  <span className="text-label font-normal">
                    · {formatDateDa(status.approvedAt.toISOString().slice(0, 10))}
                  </span>
                </p>
                <p className="text-meta mt-1 text-sm whitespace-pre-line">{status.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="border-border text-meta flex items-center gap-2 border-t pt-6 text-xs">
        <HaijMark className="h-4 w-auto" />
        <span>{t("madeWith", { product: PRODUCT_NAME })}</span>
      </footer>
    </div>
  );
}
