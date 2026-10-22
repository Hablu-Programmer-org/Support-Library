"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

const iconClass = "h-3.5 w-3.5";

function CopyIcon() {
  return (
    <svg aria-hidden="true" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect height="13" rx="2" width="13" x="9" y="9" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path d="m4 12.5 5 5L20 6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A short value (request reference, student email) that is easy to copy.
 *
 * Double-clicking the value copies it, and the icon beside it does the same for
 * anyone who does not discover the double-click. Nothing is fetched: the value is
 * already on screen, so this only touches the clipboard.
 */
export function CopyValue({
  value,
  label,
  variant = "plain",
  className,
}: {
  value: string;
  label: string;
  /** `chip` highlights the value (used for the request reference). */
  variant?: "plain" | "chip";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be denied; the value is still on screen.
      setCopied(false);
    }
  };

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        title={`Double-click to copy ${label}`}
        onDoubleClick={copy}
        className={cn(
          "select-all",
          variant === "chip" &&
            "rounded bg-primary-500/15 px-1.5 py-0.5 font-mono text-sm font-bold tracking-wide text-primary-700 dark:text-primary-300",
        )}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        title={`Copy ${label}`}
        className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? `${label} copied` : ""}
      </span>
    </span>
  );
}
