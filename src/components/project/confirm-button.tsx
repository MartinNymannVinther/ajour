"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Nothing destructive happens on one click. A real dialog rather than the
 * browser's confirm(): it can be read by a screen reader, styled like the
 * rest of the family, and says in words what will be lost and what will
 * survive.
 */
export function ConfirmButton({
  label,
  question,
  detail,
  confirmLabel,
  onConfirm,
  className,
}: {
  label: string;
  question: string;
  detail?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  className?: string;
}) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className={cn(className)}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{question}</DialogTitle>
            {detail && <DialogDescription>{detail}</DialogDescription>}
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              {confirmLabel ?? label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
