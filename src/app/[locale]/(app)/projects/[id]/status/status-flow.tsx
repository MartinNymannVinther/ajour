"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { approveStatusAction, draftStatusAction } from "@/modules/ai/actions";

/**
 * Ugen: the AI reads what actually happened and writes the draft; the
 * person edits it, answers what the AI could not know, and approves. What
 * is stored is the approved text plus the plan as it stood that day.
 */
export function StatusFlow({
  projectId,
  projectName,
  weekLabel,
}: {
  projectId: string;
  projectName: string;
  weekLabel: string;
}) {
  const t = useTranslations("status");
  const router = useRouter();
  const [text, setText] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [engine, setEngine] = useState("");
  const [fallback, setFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [approving, startApprove] = useTransition();
  const started = useRef(false);

  const draft = () => {
    setLoading(true);
    void draftStatusAction({ projectId }).then((result) => {
      if (!result.ok) {
        toast.error(result.error === "conflict" ? t("rateLimited") : t("draftFailed"));
      } else {
        setText(result.data.draft.text);
        setQuestions(result.data.draft.questions);
        setEngine(result.data.engine);
        setFallback(result.data.fallback);
        setAnswers({});
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    draft();
    // Once, on arrival: the draft is the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finalText = () => {
    const answered = questions
      .map((question, i) => ({ question, answer: (answers[i] ?? "").trim() }))
      .filter((x) => x.answer);
    return answered.length > 0
      ? `${text.trim()}\n\n${answered.map((x) => `${x.question}\n– ${x.answer}`).join("\n\n")}`
      : text.trim();
  };

  const approve = () => {
    startApprove(async () => {
      const result = await approveStatusAction({
        projectId,
        text: finalText(),
        questions,
        engine,
      });
      if (!result.ok) {
        toast.error(t("approveFailed"));
        return;
      }
      router.push(`/projects/${projectId}`);
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <p className="text-meta text-sm">{projectName}</p>
        <h1 className="font-heading text-2xl font-semibold">{t("title", { week: weekLabel })}</h1>
        <p className="text-meta mt-1 text-sm">{t("subtitle")}</p>
      </div>

      {loading ? (
        <div className="border-border bg-card rounded-xl border p-6" aria-live="polite">
          <p className="text-meta animate-pulse text-sm">{t("drafting")}</p>
        </div>
      ) : (
        <>
          {fallback && (
            <div className="border-chart-4 bg-warning-tint rounded-xl border p-3 text-sm">
              {t("fallbackNote")}
            </div>
          )}

          <div className="border-border bg-card rounded-xl border p-4">
            <label
              htmlFor="draft"
              className="text-label text-xs font-semibold tracking-wide uppercase"
            >
              {t("draftLabel")}
            </label>
            <Textarea
              id="draft"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              className="mt-1 resize-y leading-relaxed"
            />
          </div>

          {questions.length > 0 && (
            <div className="border-border bg-card rounded-xl border p-4">
              <h2 className="text-label text-xs font-semibold tracking-wide uppercase">
                {t("questionsLabel")}
              </h2>
              <div className="mt-2 space-y-3">
                {questions.map((question, i) => (
                  <div key={i}>
                    <label htmlFor={`answer-${i}`} className="text-sm">
                      {question}
                    </label>
                    <Input
                      id={`answer-${i}`}
                      value={answers[i] ?? ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                      placeholder={t("answerPlaceholder")}
                      className="mt-1"
                    />
                  </div>
                ))}
              </div>
              <p className="text-label mt-2 text-xs">{t("answersNote")}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pb-8">
            <Button type="button" size="lg" onClick={approve} disabled={approving || !text.trim()}>
              {approving ? t("approving") : t("approve")}
            </Button>
            <Button type="button" variant="outline" onClick={draft}>
              {t("redraft")}
            </Button>
            <Link
              href={`/projects/${projectId}`}
              className="text-meta hover:text-foreground ml-auto text-sm"
            >
              {t("cancel")}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
