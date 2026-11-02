"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

const BASE_INTERVAL = 20_000;
const MAX_INTERVAL = 120_000;
const FOCUS_THROTTLE = 15_000;

/**
 * Keeps the staff queue current without polling the expensive list query.
 *
 * A 20s probe reads only `{revision, count}`; when the revision changes the RSC
 * payload is refreshed in place, so the URL filters, the page number and the
 * scroll position survive. Polling stops while the tab is hidden and the probe
 * backs off on failure instead of hammering a degraded API.
 */
export function IssueRefreshControl({ initialRevision }: { initialRevision: string }) {
  const router = useRouter();
  const revision = useRef(initialRevision);
  const lastProbe = useRef(0);
  const inFlight = useRef(false);
  const [isPending, startTransition] = useTransition();
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  // The server render carries a fresh revision after every refresh; adopt it so
  // the next probe does not refresh again for a change we already rendered.
  useEffect(() => {
    revision.current = initialRevision;
  }, [initialRevision]);

  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
    setUpdatedAt(new Date());
  }, [router]);

  const probe = useCallback(async () => {
    if (document.visibilityState === "hidden") return true;
    if (inFlight.current) return true;
    inFlight.current = true;
    lastProbe.current = Date.now();
    try {
      const response = await fetch("/api/issues/activity", { cache: "no-store" });
      if (!response.ok) return false;
      const data = (await response.json()) as { revision?: string };
      if (data.revision && data.revision !== revision.current) {
        revision.current = data.revision;
        refresh();
      }
      return true;
    } finally {
      inFlight.current = false;
    }
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let interval = BASE_INTERVAL;
    const schedule = () => {
      timer = window.setTimeout(async () => {
        const ok = await probe().catch(() => false);
        interval = ok ? BASE_INTERVAL : Math.min(interval * 2, MAX_INTERVAL);
        if (!cancelled) schedule();
      }, interval);
    };
    const onFocus = () => {
      if (Date.now() - lastProbe.current >= FOCUS_THROTTLE) void probe().catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void probe().catch(() => {});
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    schedule();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [probe]);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={refresh}
        className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {isPending ? "Refreshing…" : "Refresh"}
      </button>
      <span aria-live="polite" className="hidden text-xs text-slate-500 xl:inline">
        {updatedAt
          ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
          : "Auto-updates"}
      </span>
    </div>
  );
}
