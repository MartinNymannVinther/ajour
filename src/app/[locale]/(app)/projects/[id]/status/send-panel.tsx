"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StatusRecipient } from "@/core/db/schema";

/**
 * Who gets the approved status by mail, and whether it goes this time.
 * The list lives on the project and is prefilled next week; the send is a
 * choice made at approval, every time, because dogma five says the tool
 * never sends anything out of the house without a person saying so.
 */
export function SendPanel({
  recipients,
  onRecipients,
  send,
  onSend,
  mailConfigured,
}: {
  recipients: StatusRecipient[];
  onRecipients: (next: StatusRecipient[]) => void;
  send: boolean;
  onSend: (next: boolean) => void;
  mailConfigured: boolean;
}) {
  const t = useTranslations("status.send");
  const [draft, setDraft] = useState("");

  const add = () => {
    const emails = draft
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (emails.length === 0) return;
    const known = new Set(recipients.map((r) => r.email));
    onRecipients([
      ...recipients,
      ...emails.filter((e) => !known.has(e)).map((email) => ({ name: "", email })),
    ]);
    setDraft("");
  };

  return (
    <section className="border-border bg-card rounded-xl border p-4">
      <h2 className="text-sm font-semibold">{t("title")}</h2>
      <p className="text-meta mt-0.5 text-xs">{t("hint")}</p>
      {!mailConfigured && <p className="text-warning mt-2 text-xs">{t("notConfigured")}</p>}
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {recipients.length === 0 && <li className="text-meta text-sm">{t("none")}</li>}
        {recipients.map((r) => (
          <li
            key={r.email}
            className="border-border bg-secondary flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-2.5 text-xs"
          >
            {r.email}
            <button
              type="button"
              aria-label={t("remove", { email: r.email })}
              onClick={() => onRecipients(recipients.filter((x) => x.email !== r.email))}
              className="text-meta hover:text-destructive rounded-full px-1"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="mt-2 flex gap-2"
      >
        <Input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
        />
        <Button type="submit" size="sm" variant="outline">
          {t("add")}
        </Button>
      </form>
      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={send}
          disabled={!mailConfigured || recipients.length === 0}
          onChange={(e) => onSend(e.target.checked)}
        />
        {t("checkbox")}
      </label>
    </section>
  );
}
