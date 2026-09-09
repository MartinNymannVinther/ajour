"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * A wait the person can see moving. A local model can take a minute, and a
 * pulsing line that says the same thing for sixty seconds reads as a
 * hang; a counter that ticks says the machine is still at it, and past
 * twenty seconds a line says why it takes that long and that it is fine.
 */
export function Thinking({ label, className = "" }: { label: string; className?: string }) {
  const t = useTranslations("common.thinking");
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className={`text-meta text-sm ${className}`} aria-live="polite">
      <p className="animate-pulse">
        {label}
        {seconds >= 3 && <span className="tabular-nums"> · {t("seconds", { seconds })}</span>}
      </p>
      {seconds >= 20 && <p className="text-label mt-1 text-xs">{t("slow")}</p>}
    </div>
  );
}
