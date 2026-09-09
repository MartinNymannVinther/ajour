"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StateSelect } from "@/components/project/state-select";
import { formatDateDa } from "@/core/dates";
import type { TaskState } from "@/core/db/schema";
import {
  addOwnTaskNoteAction,
  answerQuestionAction,
  forgetMeAction,
  identifyAction,
  setOwnTaskStateAction,
} from "@/modules/share/answer-actions";
import type { SharedProject } from "@/modules/share/service";

/**
 * What a participant can do on a link that may answer: say who they are,
 * mark their own tasks, leave a note on one, and answer what the latest
 * status asked. Built for a phone in a spare minute: nothing to learn,
 * nothing to drag.
 */

type Props = {
  token: string;
  shared: SharedProject;
  personId: string | null;
};

export function ParticipantPanel({ token, shared, personId }: Props) {
  const t = useTranslations("share.answer");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const me = shared.people.find((p) => p.id === personId) ?? null;

  const fail = (error: string) => {
    toast.error(t.has(`errors.${error}`) ? t(`errors.${error}`) : t("errors.generic"));
  };

  const identify = (id: string) =>
    startTransition(async () => {
      const result = await identifyAction({ token, personId: id });
      if (!result.ok) {
        fail(result.error);
        return;
      }
      router.refresh();
    });

  const forget = () =>
    startTransition(async () => {
      await forgetMeAction({ token });
      router.refresh();
    });

  if (!me) {
    return (
      <section className="border-primary/40 bg-card rounded-xl border p-5">
        <h2 className="font-heading text-sm font-semibold">{t("whoTitle")}</h2>
        <p className="text-meta mt-1 text-sm">{t("whoText")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {shared.people.map((p) => (
            <Button
              key={p.id}
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => identify(p.id)}
            >
              {p.name}
            </Button>
          ))}
          {shared.people.length === 0 && <p className="text-meta text-sm">{t("nobodyYet")}</p>}
        </div>
      </section>
    );
  }

  const mine = shared.tasks.filter((task) => task.personIds.includes(me.id));
  const latest = shared.statuses[0] ?? null;

  return (
    <section className="border-primary/40 bg-card space-y-5 rounded-xl border p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-semibold">{t("youAre", { name: me.name })}</h2>
        <Button type="button" variant="ghost" size="sm" onClick={forget} disabled={pending}>
          {t("notMe")}
        </Button>
      </div>

      <div>
        <h3 className="text-meta text-xs font-semibold tracking-wide uppercase">
          {t("yourTasks")}
        </h3>
        {mine.length === 0 ? (
          <p className="text-meta mt-1 text-sm">{t("noTasks")}</p>
        ) : (
          <ul className="divide-hairline mt-2 divide-y">
            {mine.map((task) => (
              <OwnTask
                key={task.id}
                token={token}
                task={task}
                notes={shared.replies.filter((r) => r.kind === "note" && r.taskId === task.id)}
                onFail={fail}
              />
            ))}
          </ul>
        )}
      </div>

      {latest && latest.questions.length > 0 && (
        <div>
          <h3 className="text-meta text-xs font-semibold tracking-wide uppercase">
            {t("questionsTitle")}
          </h3>
          <ul className="mt-2 space-y-4">
            {latest.questions.map((question, index) => (
              <Question
                key={index}
                token={token}
                statusUpdateId={latest.id}
                index={index}
                question={question}
                answers={shared.replies.filter(
                  (r) =>
                    r.kind === "answer" &&
                    r.statusUpdateId === latest.id &&
                    r.questionIndex === index,
                )}
                onFail={fail}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

type Reply = SharedProject["replies"][number];

function OwnTask({
  token,
  task,
  notes,
  onFail,
}: {
  token: string;
  task: SharedProject["tasks"][number];
  notes: Reply[];
  onFail: (error: string) => void;
}) {
  const t = useTranslations("share.answer");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [writing, setWriting] = useState(false);

  const setState = (state: TaskState) =>
    startTransition(async () => {
      const result = await setOwnTaskStateAction({ token, taskId: task.id, state });
      if (!result.ok) {
        onFail(result.error);
        return;
      }
      router.refresh();
    });

  const send = () =>
    startTransition(async () => {
      const result = await addOwnTaskNoteAction({ token, taskId: task.id, text: note });
      if (!result.ok) {
        onFail(result.error);
        return;
      }
      setNote("");
      setWriting(false);
      toast.success(t("noteSent"));
      router.refresh();
    });

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        <StateSelect value={task.state} onChange={setState} />
        <span className="min-w-0 flex-1 text-sm font-medium">{task.title}</span>
        <span className="text-label text-xs whitespace-nowrap">
          {formatDateDa(task.startDate)} – {formatDateDa(task.endDate)}
        </span>
      </div>
      {notes.length > 0 && (
        <ul className="mt-2 space-y-1">
          {notes.map((n) => (
            <li key={n.id} className="text-meta text-sm">
              <span className="text-foreground font-medium">{n.personName}:</span> {n.text}
            </li>
          ))}
        </ul>
      )}
      {writing ? (
        <div className="mt-2 space-y-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("notePlaceholder")}
            maxLength={600}
            autoFocus
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={send} disabled={pending || !note.trim()}>
              {t("sendNote")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setWriting(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setWriting(true)}
          className="text-primary mt-1.5 text-xs font-medium hover:underline"
        >
          {t("writeNote")}
        </button>
      )}
    </li>
  );
}

function Question({
  token,
  statusUpdateId,
  index,
  question,
  answers,
  onFail,
}: {
  token: string;
  statusUpdateId: string;
  index: number;
  question: string;
  answers: Reply[];
  onFail: (error: string) => void;
}) {
  const t = useTranslations("share.answer");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");

  const send = () =>
    startTransition(async () => {
      const result = await answerQuestionAction({
        token,
        statusUpdateId,
        questionIndex: index,
        text,
      });
      if (!result.ok) {
        onFail(result.error);
        return;
      }
      setText("");
      toast.success(t("answerSent"));
      router.refresh();
    });

  return (
    <li>
      <p className="text-sm font-medium">{question}</p>
      {answers.length > 0 && (
        <ul className="mt-1 space-y-1">
          {answers.map((a) => (
            <li key={a.id} className="text-meta text-sm">
              <span className="text-foreground font-medium">{a.personName}:</span> {a.text}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("answerPlaceholder")}
          maxLength={600}
          className="min-h-12"
        />
        <Button type="button" size="sm" onClick={send} disabled={pending || !text.trim()}>
          {t("sendAnswer")}
        </Button>
      </div>
    </li>
  );
}
