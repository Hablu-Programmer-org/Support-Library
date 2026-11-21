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
  enabled = true,
  status = "text",
}: {
  endpoint: string;
  initialRevision: string;
  intervalMs: number;
  label?: string;
  pendingLabel?: string;
  idleLabel?: string;
  /** Disable interval polling while retaining manual and focus-triggered probes. */
  enabled?: boolean;
  /**
   * How the "Auto-updates" / "Updated 14:05" status shows. `text` (default) is a
   * caption beside the button; `dot` folds it into the button as a green dot plus
   * a tooltip, for headers where a loose caption reads as clutter. Either way the
   * status stays in a polite live region for screen readers.
   */
  status?: "text" | "dot";
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
    if (enabled) schedule();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, intervalMs, probe]);

  const statusText = updatedAt ? `Updated ${timeFormatter.format(updatedAt)}` : idleLabel;

  if (status === "dot") {
    return (
      <>
        <button
          type="button"
          disabled={isPending}
          onClick={refresh}
          title={statusText}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-950"
        >
          <svg
            aria-hidden="true"
            className={isPending ? "motion-safe:animate-spin" : undefined}
            fill="none"
            height={16}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            viewBox="0 0 24 24"
            width={16}
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
          {isPending ? pendingLabel : label}
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-success-500"
            data-testid="auto-refresh-dot"
          />
        </button>
        <span aria-live="polite" className="sr-only">
          {statusText}
        </span>
      </>
    );
  }

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
        {statusText}
      </span>
    </div>
  );
}
