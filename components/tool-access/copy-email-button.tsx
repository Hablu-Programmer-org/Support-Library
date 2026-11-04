"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Copies a student's email so an admin can paste it into the n8n or OpenAI
 * dashboard. Clipboard access can be unavailable (insecure origin, denied
 * permission), so a hidden textarea fallback keeps the control usable.
 */
async function copyText(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement("textarea");
    try {
      area.value = value;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      return document.execCommand("copy");
    } finally {
      area.remove();
    }
  } catch {
    return false;
  }
}

export function CopyEmailButton({
  email,
  className = "",
}: {
  email: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const resetTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    },
    [],
  );

  const onCopy = async () => {
    const ok = await copyText(email);
    setState(ok ? "copied" : "failed");
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setState("idle"), 1800);
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={state === "copied" ? "Email copied" : `Copy ${email}`}
      className={`group inline-flex max-w-full items-center gap-1.5 rounded-sm text-left text-xs font-medium text-slate-700 transition-colors hover:text-cyan-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 focus-visible:ring-offset-2 motion-reduce:transition-none dark:text-slate-200 dark:hover:text-cyan-300 dark:focus-visible:ring-offset-slate-950 ${className}`}
      title="Click to copy email"
    >
      <span className="min-w-0 truncate">{email}</span>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100">
        {state === "copied" ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        ) : (
          <>
            <rect x="8.25" y="8.25" width="11.5" height="11.5" rx="2.5" />
            <path strokeLinecap="round" d="M15.75 8.25V6.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h1.75" />
          </>
        )}
      </svg>
      <span
        aria-live="polite"
        className={`shrink-0 text-[11px] no-underline ${
          state === "copied"
            ? "text-emerald-600 dark:text-emerald-400"
            : state === "failed"
              ? "text-red-600 dark:text-red-400"
              : "sr-only"
        }`}
      >
        {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : ""}
      </span>
    </button>
  );
}
