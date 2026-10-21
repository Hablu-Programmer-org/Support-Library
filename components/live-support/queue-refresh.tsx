"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { cn } from "@/lib/cn";

/**
 * Keeps the live support queue current during a shift.
 *
 * The page is server-rendered and a join can happen at any second, so a mentor
 * would otherwise be looking at a stale "nobody is waiting" until they hit
 * reload. This refreshes the server component while the tab is visible (never in
 * a background tab) and offers a manual button for the impatient case.
 */
export function QueueRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
      setCheckedAt(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Dhaka",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        }).format(new Date()),
      );
    });
  }, [router]);

  useEffect(() => {
    const id = window.setInterval(() => {
      // A hidden tab already has stale data; refreshing it would only cost queries.
      if (document.visibilityState !== "visible") return;
      refresh();
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [intervalMs, refresh]);

  return (
    <button
      type="button"
      onClick={refresh}
      className={cn(
        "inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition",
        "border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800",
      )}
    >
      {pending ? "Refreshing…" : "Refresh"}
      {checkedAt && (
        <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">
          · {checkedAt} Dhaka
        </span>
      )}
    </button>
  );
}
