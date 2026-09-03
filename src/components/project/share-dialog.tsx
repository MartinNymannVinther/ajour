"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDateDa } from "@/core/dates";
import { createShareLinkAction, revokeShareLinkAction } from "@/modules/share/actions";
import type { ShareLinkView } from "@/modules/projects/types";
import { SHARE_TTL_OPTIONS } from "@/modules/share/constants";

/**
 * A link that opens the project's status page for anyone holding it. The
 * token is shown once, here, because what the database keeps is its hash:
 * a lost link is revoked and made again, never looked up.
 */
export function ShareDialog({ projectId, links }: { projectId: string; links: ShareLinkView[] }) {
  const t = useTranslations("projects.share");
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [ttl, setTtl] = useState<number | null>(90);
  const [fresh, setFresh] = useState<{ id: string; url: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const live = links.filter((link) => !link.revokedAt);

  const create = () => {
    startTransition(async () => {
      const result = await createShareLinkAction({ projectId, label, ttlDays: ttl });
      if (!result.ok) {
        toast.error(t("createFailed"));
        return;
      }
      setFresh({ id: result.data.id, url: result.data.url });
      setLabel("");
    });
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>{t("open")}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {fresh && (
          <div className="border-success bg-success-tint space-y-2 rounded-lg border p-3">
            <p className="text-success text-sm font-medium">{t("freshTitle")}</p>
            <code className="bg-card block overflow-x-auto rounded px-2 py-1 text-xs">
              {fresh.url}
            </code>
            <Button type="button" size="sm" onClick={() => copy(fresh.url)}>
              {t("copy")}
            </Button>
            <p className="text-meta text-xs">{t("shownOnce")}</p>
          </div>
        )}

        <div className="space-y-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t("labelPlaceholder")}
            aria-label={t("labelPlaceholder")}
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={ttl === null ? "" : String(ttl)}
              onChange={(e) => setTtl(e.target.value === "" ? null : Number(e.target.value))}
              aria-label={t("expiryLabel")}
              className="border-input bg-card focus-visible:ring-ring rounded-lg border px-2 py-2 text-sm outline-none focus-visible:ring-2"
            >
              {SHARE_TTL_OPTIONS.map((option) => (
                <option key={String(option)} value={option === null ? "" : String(option)}>
                  {option === null ? t("noExpiry") : t("days", { days: option })}
                </option>
              ))}
            </select>
            <Button type="button" size="sm" onClick={create} disabled={pending}>
              {t("create")}
            </Button>
          </div>
        </div>

        <ul className="space-y-1.5">
          {live.length === 0 && <li className="text-meta text-sm">{t("none")}</li>}
          {live.map((link) => (
            <li key={link.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 truncate">{link.label || t("unnamed")}</span>
              <span className="text-meta ml-auto shrink-0 text-xs">
                {link.expiresAt
                  ? t("expires", { date: formatDateDa(link.expiresAt.toISOString().slice(0, 10)) })
                  : t("noExpiry")}
              </span>
              <Button
                type="button"
                variant="destructive"
                size="xs"
                onClick={() =>
                  startTransition(async () => {
                    const result = await revokeShareLinkAction({ linkId: link.id, projectId });
                    if (result.ok) {
                      if (fresh?.id === link.id) setFresh(null);
                      toast.success(t("revoked"));
                    } else toast.error(t("revokeFailed"));
                  })
                }
              >
                {t("revoke")}
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
