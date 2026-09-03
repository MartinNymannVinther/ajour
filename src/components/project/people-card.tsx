"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Person } from "@/core/db/schema";
import { FUNCTION_ACCENT, SECTION_IDS } from "@/modules/projects/constants";
import { FunctionSection } from "./function-card";
import { ConfirmButton } from "./confirm-button";

/**
 * The workspace's people. They are identities, not strings: renaming one
 * here renames them everywhere, which is the point of having the register
 * at all.
 */

export function PeopleCard({
  people,
  usage,
  onRename,
  onRemove,
}: {
  people: Person[];
  usage: Map<string, number>;
  onRename: (personId: string, name: string) => void;
  onRemove: (personId: string) => void;
}) {
  const t = useTranslations("projects.people");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  return (
    <FunctionSection
      id={SECTION_IDS.people}
      accent={FUNCTION_ACCENT.people}
      title={t("title")}
      count={people.length}
      defaultOpen={false}
    >
      <div className="bg-secondary space-y-2 rounded-lg p-3">
        {people.length === 0 && <p className="text-meta text-sm">{t("empty")}</p>}
        <ul className="space-y-1">
          {people.map((person) => {
            const count = usage.get(person.id) ?? 0;
            return (
              <li key={person.id} className="flex items-center gap-2 text-sm">
                {editing === person.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (draft.trim()) onRename(person.id, draft.trim());
                      setEditing(null);
                    }}
                    className="flex flex-1 gap-2"
                  >
                    <Input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      aria-label={t("rename")}
                    />
                    <Button type="submit" size="sm">
                      {t("save")}
                    </Button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(person.name);
                        setEditing(person.id);
                      }}
                      className="hover:text-primary min-h-[24px] min-w-0 truncate text-left"
                    >
                      {person.name}
                    </button>
                    <span className="text-meta ml-auto shrink-0 text-xs">
                      {t("onTasks", { count })}
                    </span>
                    {count === 0 && (
                      <ConfirmButton
                        label="✕"
                        question={t("removeQuestion", { name: person.name })}
                        confirmLabel={t("remove")}
                        onConfirm={() => onRemove(person.id)}
                        className="h-6 shrink-0 px-1.5"
                      />
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-meta text-xs">{t("hint")}</p>
      </div>
    </FunctionSection>
  );
}
