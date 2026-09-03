"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The two shells a project page is built from: a card that is always open
 * for the plan, and a collapsible one for the side column. Both carry a
 * coloured left edge naming the function, a heading, and a count.
 *
 * The collapsible one is a real <details>, so it opens from a link, works
 * without JavaScript, and reaches the keyboard for free.
 */

function CountBadge({ count, alert }: { count?: number; alert?: boolean }) {
  if (typeof count !== "number") return null;
  return (
    <span
      className={cn(
        "rounded-full px-1.5 text-[11px] font-medium tracking-normal normal-case",
        alert ? "bg-warning-tint text-warning" : "bg-card text-meta ring-border ring-1 ring-inset",
      )}
    >
      {count}
    </span>
  );
}

export function FunctionCard({
  id,
  title,
  count,
  alert,
  accent,
  actions,
  children,
}: {
  id?: string;
  title: string;
  count?: number;
  alert?: boolean;
  accent: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="bg-card border-border overflow-hidden rounded-xl border shadow-[var(--surface-shadow)]"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <div className="border-border bg-secondary flex items-center gap-2 border-b px-4 py-2.5">
        <h2 className="text-meta font-heading text-xs font-semibold tracking-wide uppercase">
          {title}
        </h2>
        <CountBadge count={count} alert={alert} />
        {actions && <div className="ml-auto">{actions}</div>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function FunctionSection({
  id,
  title,
  count,
  badge,
  alert,
  accent,
  defaultOpen = true,
  children,
}: {
  id: string;
  title: string;
  count?: number;
  badge?: string;
  alert?: boolean;
  accent: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      id={id}
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="group bg-card border-border overflow-hidden rounded-xl border shadow-[var(--surface-shadow)]"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <summary className="bg-secondary text-meta hover:bg-sidebar-hover focus-visible:ring-ring flex cursor-pointer items-center gap-2 px-4 py-2.5 text-xs font-semibold tracking-wide uppercase select-none focus-visible:ring-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <span className="text-label inline-block w-3 transition group-open:rotate-90" aria-hidden>
          ▸
        </span>
        <span className="font-heading">{title}</span>
        <CountBadge count={count} alert={alert} />
        {badge && (
          <span className="text-meta ml-auto text-xs font-normal tracking-normal normal-case">
            {badge}
          </span>
        )}
      </summary>
      <div className="border-border border-t p-4">{children}</div>
    </details>
  );
}
