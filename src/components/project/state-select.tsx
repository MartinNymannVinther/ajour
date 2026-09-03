"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { TaskState } from "@/core/db/schema";

/**
 * The task's three states, as a real select. Three visible choices rather
 * than a chip that cycles: it works with a keyboard, with touch, and with
 * a screen reader, which the panel asked for and the phone needs.
 */

const ARROW =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='6' viewBox='0 0 8 6'><path d='M1 1l3 3 3-3' fill='none' stroke='currentColor' stroke-width='1.5'/></svg>\")";

export function StateSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (state: TaskState) => void;
  className?: string;
}) {
  const t = useTranslations("projects.states");
  const colors =
    value === "done"
      ? "border-success bg-success-tint text-success"
      : value === "doing"
        ? "border-primary bg-primary text-primary-foreground"
        : "border-input bg-card text-meta";
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as TaskState)}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={t("label")}
      className={cn(
        "focus-visible:ring-ring min-h-[24px] shrink-0 cursor-pointer appearance-none rounded-full border py-0.5 pr-5 pl-2.5 text-[11px] font-medium outline-none focus-visible:ring-2",
        colors,
        className,
      )}
      style={{
        backgroundImage: ARROW,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 6px center",
      }}
    >
      <option value="todo">{t("todo")}</option>
      <option value="doing">{t("doing")}</option>
      <option value="done">{t("done")}</option>
    </select>
  );
}
