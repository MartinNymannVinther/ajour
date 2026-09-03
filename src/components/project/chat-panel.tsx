"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { renderEvent } from "@/modules/projects/events";
import { sendChatAction, undoChatChangeAction } from "@/modules/ai/actions";
import type { AppliedLine } from "@/modules/ai/apply";
import type { CreatedRows } from "@/modules/projects/snapshots";
import { cn } from "@/lib/utils";

/**
 * The chat that can act on the whole project. The AI proposes and writes;
 * the person decides, and can take any of it back: a copy of the plan is
 * taken before every change, and the message that made the change carries
 * the undo.
 */

type Item = {
  role: "user" | "assistant";
  content: string;
  applied?: { lines: AppliedLine[]; snapshotId: string; created: CreatedRows; undone: boolean };
};

export function ChatPanel({
  projectId,
  history,
}: {
  projectId: string;
  history: Array<{ role: string; content: string; applied: unknown }>;
}) {
  const t = useTranslations("chat");
  const eventText = useTranslations("events");
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>(() =>
    history.map((row) => {
      const applied = row.applied as Item["applied"] | null;
      return {
        role: row.role === "user" ? "user" : "assistant",
        content: row.content,
        applied: applied
          ? { ...applied, undone: Boolean((applied as { undoneAt?: string }).undoneAt) }
          : undefined,
      };
    }),
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [fallback, setFallback] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const scrollDown = () =>
    setTimeout(
      () => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }),
      50,
    );

  const send = () => {
    const message = input.trim();
    if (!message || loading) return;
    setInput("");
    setItems((m) => [...m, { role: "user", content: message }]);
    setLoading(true);
    scrollDown();
    void (async () => {
      const result = await sendChatAction({ projectId, message });
      if (!result.ok) {
        setItems((m) => [
          ...m,
          {
            role: "assistant",
            content: result.error === "conflict" ? t("rateLimited") : t("failed"),
          },
        ]);
      } else {
        const outcome = result.data;
        setItems((m) => [
          ...m,
          {
            role: "assistant",
            content: outcome.reply,
            applied: outcome.applied ? { ...outcome.applied, undone: false } : undefined,
          },
        ]);
        setFallback(outcome.fallback);
        if (outcome.applied) router.refresh();
      }
      setLoading(false);
      scrollDown();
    })();
  };

  const undo = (index: number) => {
    const item = items[index];
    if (!item?.applied || item.applied.undone) return;
    const { snapshotId, created } = item.applied;
    setItems((m) =>
      m.map((x, i) =>
        i === index && x.applied ? { ...x, applied: { ...x.applied, undone: true } } : x,
      ),
    );
    startTransition(async () => {
      await undoChatChangeAction({ projectId, snapshotId, created });
      router.refresh();
    });
  };

  return (
    <section className="border-primary/25 bg-accent/40 overflow-hidden rounded-xl border shadow-[var(--surface-shadow)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <span className="bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold">
          AI
        </span>
        <span className="text-sm font-semibold">{t("title")}</span>
        <span className="text-meta ml-2 hidden text-xs sm:inline">{t("subtitle")}</span>
        <span className="text-label ml-auto" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div className="border-primary/15 bg-card border-t p-4">
          <div ref={listRef} className="max-h-80 space-y-3 overflow-y-auto pr-1" aria-live="polite">
            {items.length === 0 && <p className="text-label text-sm">{t("examples")}</p>}
            {items.map((item, i) => (
              <div key={i}>
                <div className={cn("flex", item.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-xl px-3.5 py-2 text-sm whitespace-pre-line",
                      item.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {item.content}
                  </div>
                </div>
                {item.applied && (
                  <div
                    className={cn(
                      "mt-1.5 max-w-[85%] rounded-xl border p-3 text-[13px]",
                      item.applied.undone
                        ? "border-border bg-secondary text-meta"
                        : "border-success bg-success-tint text-success",
                    )}
                  >
                    <p className="font-semibold">
                      {item.applied.undone ? t("rolledBack") : t("applied")}
                    </p>
                    <ul className="mt-0.5 space-y-0.5">
                      {item.applied.lines.map((line, j) => (
                        <li key={j}>· {renderEvent(eventText, line)}</li>
                      ))}
                    </ul>
                    {!item.applied.undone && (
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        className="mt-1.5"
                        onClick={() => undo(i)}
                      >
                        {t("undo")}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {loading && <p className="text-label animate-pulse text-sm">{t("thinking")}</p>}
          </div>

          {fallback && <p className="text-warning mt-2 text-xs">{t("fallback")}</p>}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="mt-3 flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("placeholder")}
              aria-label={t("placeholder")}
            />
            <Button type="submit" disabled={loading || !input.trim()}>
              {t("send")}
            </Button>
          </form>
          <p className="text-label mt-1.5 text-[11px]">{t("note")}</p>
        </div>
      )}
    </section>
  );
}
