import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ABC_FIGURES } from "./abc-figures";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help");
  return { title: t("title") };
}

const ABC_COUNT = 10;
const HOW_TO = [
  "start",
  "plan",
  "breakdown",
  "tip",
  "economy",
  "status",
  "share",
  "model",
] as const;

/**
 * Two things on this page: how the tool works, and how to run a small
 * project. The second is the more important one — the ten rules below are
 * what the tool is shaped around, and they hold whether or not anyone
 * ever uses Ajour.
 */
export default async function HelpPage() {
  const t = await getTranslations("help");

  return (
    <div className="mx-auto max-w-2xl pb-16">
      <h1 className="font-heading text-2xl font-semibold">{t("title")}</h1>
      <p className="text-meta mt-1 text-sm">{t("intro")}</p>

      <h2 className="font-heading mt-10 text-xl font-semibold">{t("howToTitle")}</h2>
      {HOW_TO.map((key) => (
        <section key={key}>
          <h3 className="text-primary mt-5 text-[15px] font-semibold">{t(`howTo.${key}.title`)}</h3>
          <p className="mt-1.5 text-[15px] leading-relaxed">{t(`howTo.${key}.body`)}</p>
        </section>
      ))}

      <h2 className="font-heading mt-10 text-xl font-semibold">{t("abcTitle")}</h2>
      <p className="text-meta mt-1.5 text-sm">{t("abcIntro")}</p>

      {Array.from({ length: ABC_COUNT }, (_, i) => (
        <div
          key={i}
          className="border-border bg-card mt-6 flex gap-4 rounded-xl border p-4 shadow-[var(--surface-shadow)]"
        >
          <div className="hidden w-28 shrink-0 items-start justify-center pt-1 sm:flex" aria-hidden>
            <svg viewBox="0 0 120 84" className="w-28">
              {ABC_FIGURES[i]}
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="text-primary text-[15px] font-semibold">
              {i + 1}. {t(`abc.${i}.title`)}
            </h3>
            <p className="mt-1 text-[15px] leading-relaxed">{t(`abc.${i}.body`)}</p>
          </div>
        </div>
      ))}

      <p className="border-border bg-card text-meta mt-10 rounded-xl border p-4 text-sm">
        {t("closing")}
      </p>
    </div>
  );
}
