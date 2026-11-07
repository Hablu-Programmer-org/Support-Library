"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { ChevronDownIcon, CloseIcon, SearchIcon } from "@/components/icons";
import { nativeFieldClass } from "@/lib/config/fields";
import {
  buildIssueListHref,
  type IssueFilterDefaults,
} from "@/lib/issue-list-params";
import { SEARCH_MIN_QUERY_LENGTH } from "@/lib/search";

const DEBOUNCE_MS = 200;
/**
 * An in-flight echo is only remembered briefly, and the set is bounded.
 *
 * A FIFO eviction of the oldest entry was wrong (echoes arrive in request
 * order, so the oldest is the *next* one to arrive; dropping it made its echo
 * look like an external navigation). Instead, entries older than the prune
 * window are dropped — a router that has not echoed within it is not going to —
 * and a hard cap clears the set as a backstop.
 */
const IN_FLIGHT_PRUNE_AFTER_MS = 10_000;
const IN_FLIGHT_MAX = 100;

/**
 * Instant keyword search.
 *
 * The URL stays the source of truth, but the input is a controlled draft on top
 * of it. Three rules make it feel reliable:
 *
 * 1. A server echo never overwrites what the user is typing. Every value we ask
 *    the router for is recorded; a prop that matches one of those is treated as
 *    our own echo, not as an external navigation.
 * 2. Deleting or clearing navigates immediately (`delay = 0`), typing waits for
 *    a short pause. The old 400 ms wait on every keystroke made deletion look
 *    stuck.
 * 3. Bengali/IME composition never navigates mid-word.
 *
 * Enter flushes the pending value and keeps the whole filter object, so a
 * collapsed advanced panel can no longer drop filters.
 */
export function IssueSearchField({
  defaults,
  defaultSort,
  open,
  onToggle,
}: {
  defaults: IssueFilterDefaults;
  defaultSort?: "answer" | "newest" | "oldest" | "priority" | "relevance";
  open: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaults.q);
  const [isPending, startTransition] = useTransition();

  const inputRef = useRef<HTMLInputElement>(null);
  const defaultsRef = useRef(defaults);
  /**
   * Values already requested from the router, with request time for pruning.
   * The server value is seeded by the effect below, not during render.
   */
  const inFlight = useRef<Map<string, number>>(new Map());
  const lastSeenServerValue = useRef(defaults.q);
  const previousValue = useRef(defaults.q);
  const composing = useRef(false);

  // Keep the latest server state available to event handlers without touching
  // the ref during render.
  useEffect(() => {
    defaultsRef.current = defaults;
  }, [defaults]);

  // Seed the initial server value once, so an initial echo of it is ignored.
  useEffect(() => {
    inFlight.current.set(defaults.q, Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External navigation (Reset, back/forward, a filter submit) is adopted.
  // Our own echo is ignored so it cannot roll the input back to an older query.
  useEffect(() => {
    if (defaults.q === lastSeenServerValue.current) return;
    lastSeenServerValue.current = defaults.q;

    if (inFlight.current.has(defaults.q)) {
      inFlight.current.delete(defaults.q);
      return;
    }

    setValue(defaults.q);
    previousValue.current = defaults.q;
  }, [defaults.q]);

  const apply = useCallback(
    (rawValue: string) => {
      const next = rawValue.trim();
      // One character is not a query: keep the current results and show a hint.
      if (next.length === 1) return;
      if (next === defaultsRef.current.q) return;

      const now = Date.now();
      for (const [value, at] of inFlight.current) {
        if (now - at > IN_FLIGHT_PRUNE_AFTER_MS) inFlight.current.delete(value);
      }
      inFlight.current.set(next, now);
      if (inFlight.current.size > IN_FLIGHT_MAX) {
        inFlight.current.clear();
        inFlight.current.set(next, now);
      }

      // A search always restarts at page 1 and keeps every other filter.
      const href = buildIssueListHref(
        { ...defaultsRef.current, q: next, page: 1 },
        { defaultSort },
      );
      startTransition(() => {
        router.replace(href, { scroll: false });
      });
    },
    [defaultSort, router],
  );

  useEffect(() => {
    if (composing.current) return;

    const next = value.trim();
    if (next === defaultsRef.current.q) {
      previousValue.current = value;
      return;
    }
    // Typing a single character must not navigate, but the hint still shows.
    if (next.length === 1) {
      previousValue.current = value;
      return;
    }

    const deleting = value.length < previousValue.current.length;
    previousValue.current = value;
    // Clearing or backspacing is immediate; typing is debounced.
    const delay = next.length === 0 || deleting ? 0 : DEBOUNCE_MS;
    const timer = window.setTimeout(() => apply(next), delay);
    return () => window.clearTimeout(timer);
  }, [value, apply]);

  // The effect below picks up the cleared value and applies it at delay 0;
  // applying here as well would navigate twice.
  const clear = useCallback(() => {
    setValue("");
    previousValue.current = "";
    inputRef.current?.focus();
  }, []);

  const showHint = value.trim().length === 1;

  return (
    <div className="space-y-1">
      <div className="relative">
        <SearchIcon
          className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${
            isPending ? "animate-pulse text-primary" : "text-slate-400"
          }`}
          size={18}
        />
        <input
          ref={inputRef}
          aria-describedby={showHint ? "issue-search-hint" : undefined}
          aria-label="Search issues"
          autoComplete="off"
          className={`${nativeFieldClass} pl-10 pr-16`}
          enterKeyHint="search"
          name="q"
          placeholder="Search by problem, answer or keyword"
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={(event) => {
            composing.current = false;
            const next = event.currentTarget.value;
            setValue(next);
            previousValue.current = next;
            apply(next);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              apply(value);
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              clear();
            }
          }}
        />
        {value !== "" && (
          <button
            aria-label="Clear search"
            className="absolute right-10 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            onClick={clear}
            type="button"
          >
            <CloseIcon size={14} />
          </button>
        )}
        <button
          aria-expanded={open}
          aria-label="Advanced filters"
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          onClick={onToggle}
          type="button"
        >
          <ChevronDownIcon
            className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            size={18}
          />
        </button>
        <span aria-live="polite" className="sr-only">
          {isPending ? "Searching" : ""}
        </span>
      </div>
      {showHint && (
        <p className="px-1 text-xs text-slate-500 dark:text-slate-400" id="issue-search-hint">
          Type at least {SEARCH_MIN_QUERY_LENGTH} characters to search.
        </p>
      )}
    </div>
  );
}
