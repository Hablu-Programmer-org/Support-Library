"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { SearchIcon } from "@/components/icons";
import { nativeFieldClass } from "@/lib/config/fields";
import {
  buildAccessRequestHref,
  type AccessRequestListState,
  type AccessRequestTab,
} from "@/lib/access-request-list-params";

const DEBOUNCE_MS = 400;

const TABS: { id: AccessRequestTab; label: string }[] = [
  { id: "openai", label: "OpenAI" },
  { id: "n8n", label: "n8n" },
];

/**
 * Tabs, live email search and the "already sent" toggle for the staff queue.
 *
 * Every control writes to the URL, so a refresh, a shared link or the back
 * button restores the exact view. Search navigates after a short pause (no
 * submit button); a tab or toggle change applies immediately.
 */
export function AccessRequestToolbar({
  state,
  counts,
}: {
  state: AccessRequestListState;
  counts: Record<AccessRequestTab, number>;
}) {
  const router = useRouter();
  const [value, setValue] = useState(state.q);
  // The checkbox is optimistic: a controlled input that waits for the server
  // round-trip snaps back to its old value mid-click, which reads as "broken".
  const [showSent, setShowSent] = useState(state.showSent);
  const [isPending, startTransition] = useTransition();
  const lastApplied = useRef(state.q);

  // Re-sync with the server value: back/forward, a tab change or Reset all
  // arrive as new props.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors a server prop change
    setValue(state.q);
    lastApplied.current = state.q;
  }, [state.q]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors a server prop change
    setShowSent(state.showSent);
  }, [state.showSent]);

  const navigate = (patch: Partial<AccessRequestListState>) => {
    const q = value.trim();
    const next = buildAccessRequestHref(
      { ...state, q, page: 1 },
      patch,
    );
    lastApplied.current = q;
    // `replace`, not `push`: typing must not fill the back button with one entry
    // per pause, and switching tabs is not a new page in the user's journey.
    startTransition(() => router.replace(next, { scroll: false }));
  };

  useEffect(() => {
    const next = value.trim();
    if (next === lastApplied.current) return;

    const timer = window.setTimeout(() => {
      lastApplied.current = next;
      startTransition(() => {
        router.replace(
          buildAccessRequestHref({ ...state, q: next, page: 1 }),
          { scroll: false },
        );
      });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [value, state, router]);

  const searching = isPending;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          aria-label="Access request type"
          className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-900/70"
          role="group"
        >
          {TABS.map((tab) => {
            const active = state.tab === tab.id;
            const count = counts[tab.id];
            return (
              <button
                key={tab.id}
                aria-pressed={active}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  active
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
                onClick={() => navigate({ tab: tab.id })}
                type="button"
              >
                {tab.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                    count > 0
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                      : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                  }`}
                >
                  {count} pending
                </span>
              </button>
            );
          })}
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            checked={showSent}
            className="h-4 w-4 rounded border-slate-300 accent-cyan-600 dark:border-slate-600"
            onChange={(event) => {
              const next = event.target.checked;
              setShowSent(next);
              navigate({ showSent: next });
            }}
            type="checkbox"
          />
          Show completed
        </label>
      </div>

      <div>
        <div className="relative">
          <SearchIcon
            className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${
              searching ? "animate-pulse text-primary" : "text-slate-400"
            }`}
            size={18}
          />
          <input
            aria-label="Search by student email"
            className={`${nativeFieldClass} px-10`}
            enterKeyHint="search"
            placeholder="Search student email"
            type="search"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              navigate({ q: value.trim(), page: 1 });
            }}
          />
          {value && (
            <button
              aria-label="Clear email search"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              onClick={() => {
                setValue("");
                navigate({ q: "", page: 1 });
              }}
              type="button"
            >
              <svg
                aria-hidden
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          )}
          <span aria-live="polite" className="sr-only">
            {searching ? "Searching" : ""}
          </span>
        </div>
        {value.trim().length === 1 && (
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Type at least 2 characters to search.
          </p>
        )}
      </div>
    </div>
  );
}
