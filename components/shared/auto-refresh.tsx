"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { SUPPORT_TIME_ZONE } from "@/lib/config/live-support";

const MAX_INTERVAL = 120_000;
const FOCUS_THROTTLE = 5_000;

// Fixed locale + time zone, so the status line can never disagree with itself
// between the server render and the browser (see `formatSupportShortDate`).
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: SUPPORT_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * Keeps a server-rendered list or page current without polling the full query.
 *
 * Every `intervalMs` it reads a tiny `{ revision }` token; only a changed token
 * triggers `router.refresh()`, so filters, the page number and the scroll
 * position survive. Polling stops while the tab is hidden, backs off on failure
 * instead of hammering a degraded API, and re-checks as soon as the tab is
 * focused again. The revision is not content: the refresh re-runs every
 * server-side authorization check, so the client never injects data.
 */
export function AutoRefresh({
  endpoint,
  initialRevision,
  intervalMs,
  label = "Refresh",
  pendingLabel = "Refreshing…",
  idleLabel = "Auto-updates",
}: {
  endpoint: string;
  initialRevision: string;
  intervalMs: number;
  label?: string;
  pendingLabel?: string;
  idleLabel?: string;
}) {
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
      const response = await fetch(endpoint, { cache: "no-store" });
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
  }, [endpoint, refresh]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let interval = intervalMs;
    const schedule = () => {
      timer = window.setTimeout(async () => {
        const ok = await probe().catch(() => false);
        interval = ok ? intervalMs : Math.min(interval * 2, MAX_INTERVAL);
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
  }, [intervalMs, probe]);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={refresh}
        className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {isPending ? pendingLabel : label}
      </button>
      <span aria-live="polite" className="hidden text-xs text-slate-500 xl:inline">
        {updatedAt ? `Updated ${timeFormatter.format(updatedAt)}` : idleLabel}
      </span>
    </div>
  );
}
