"use client";

import { useEffect, useRef, useState } from "react";

import { CheckCircleIcon, SparklesIcon } from "@/components/icons";
import { nativeTextareaClass } from "@/lib/config/fields";

type CopyStatus = "idle" | "copied" | "error";

/**
 * Copies the server-built AI prompt for this issue.
 *
 * The prompt arrives as a prop and never comes from the DOM: page text includes
 * student PII and internal controls, while the prop is an explicit allowlist. If
 * the Clipboard API is unavailable or denied, the same prompt is revealed in a
 * read-only textarea so the admin can still copy it by hand.
 */
export function CopyForAiButton({ prompt }: { prompt: string }) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    if (timer.current) window.clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(prompt);
      setStatus("copied");
      timer.current = window.setTimeout(() => setStatus("idle"), 2000);
    } catch {
      // Clipboard access can be denied (insecure context, permission). The
      // prompt is still offered below for a manual copy.
      setStatus("error");
    }
  };

  return (
    <div className="flex min-w-0 flex-col items-stretch gap-2 sm:items-end">
      <button
        type="button"
        onClick={copy}
        aria-label="Copy for AI"
        title="Copy this issue's context as a structured AI prompt"
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 motion-reduce:transition-none dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {status === "copied" ? (
          <CheckCircleIcon size={16} />
        ) : (
          <SparklesIcon size={16} />
        )}
        {status === "copied" ? "Copied for AI" : "Copy for AI"}
      </button>

      <span aria-live="polite" className="sr-only">
        {status === "copied"
          ? "Issue context copied. Paste it into your AI assistant and attach the screenshots separately."
          : status === "error"
            ? "Could not copy automatically. Select the prompt below and copy it manually."
            : ""}
      </span>

      {status === "error" && (
        <div className="w-full text-left sm:max-w-xl">
          <p
            role="alert"
            className="text-xs font-medium text-danger-700 dark:text-danger-300"
          >
            Could not copy automatically. Select the prompt below and copy it
            manually.
          </p>
          <textarea
            aria-label="AI prompt to copy manually"
            className={`${nativeTextareaClass} mt-2 font-mono text-xs`}
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            rows={8}
            value={prompt}
          />
        </div>
      )}
    </div>
  );
}
