"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";

import { CloseIcon, SearchIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
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
  trailing,
}: {
  defaults: IssueFilterDefaults;
  defaultSort?: "answer" | "newest" | "oldest" | "priority" | "relevance";
  /** Rendered inside the bar on the right (e.g. the Filters button). */
  trailing?: ReactNode;
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

  // "/" jumps to search from anywhere on the page, like most search UIs. It
  // never steals a keystroke meant for another field, an IME, or a shortcut.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.isComposing) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const showHint = value.trim().length === 1;

  return (
    <div className="space-y-1">
      {/* Gradient border via 1px padding: grey at rest, cyan→violet on focus. */}
      <div
        className={cn(
          "group/search relative rounded-2xl bg-slate-200 p-px transition-shadow duration-200 hover:bg-slate-300 dark:bg-slate-700/80 dark:hover:bg-slate-600",
          "focus-within:bg-linear-to-r focus-within:from-cyan-500 focus-within:via-sky-500 focus-within:to-violet-500",
          "focus-within:shadow-[0_0_36px_-10px_rgba(6,182,212,0.7)] motion-reduce:transition-none",
        )}
      >
        <div className="relative flex h-13 items-center gap-1 overflow-hidden rounded-[15px] bg-white pr-1.5 dark:bg-slate-900">
          <SearchIcon
            className={cn(
              "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 transition-colors",
              isPending
                ? "text-cyan-500"
                : "text-slate-400 group-focus-within/search:text-cyan-500",
            )}
            size={20}
          />
          <input
            ref={inputRef}
            aria-describedby={showHint ? "issue-search-hint" : undefined}
            aria-keyshortcuts="/"
            aria-label="Search issues"
            autoComplete="off"
            className="h-full min-w-0 flex-1 border-0 bg-transparent pl-12 pr-2 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
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
          {value !== "" ? (
            <button
              aria-label="Clear search"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              onClick={clear}
              type="button"
            >
              <CloseIcon size={16} />
            </button>
          ) : (
            <kbd
              aria-hidden="true"
              className="mr-1 hidden h-6 min-w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-1.5 font-mono text-xs text-slate-500 group-focus-within/search:opacity-0 sm:inline-flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
              data-testid="search-shortcut-hint"
            >
              /
            </kbd>
          )}
          {trailing && (
            <>
              <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
              {trailing}
            </>
          )}
          {isPending && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden"
              data-testid="search-progress"
            >
              <span className="block h-full w-2/5 bg-linear-to-r from-transparent via-cyan-400 to-transparent motion-safe:animate-[issue-search-progress_1s_ease-in-out_infinite]" />
            </span>
          )}
        </div>
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

/** A key event aimed at something the user is typing into. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
