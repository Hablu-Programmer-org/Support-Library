"use client";

import { useState } from "react";

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
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
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

  const onCopy = async () => {
    const ok = await copyText(email);
    setState(ok ? "copied" : "failed");
    window.setTimeout(() => setState("idle"), 1800);
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={state === "copied" ? "Email copied" : `Copy ${email}`}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-cyan-500 dark:hover:text-cyan-300 ${className}`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5">
        {state === "copied" ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        ) : (
          <>
            <rect x="8.25" y="8.25" width="11.5" height="11.5" rx="2.5" />
            <path strokeLinecap="round" d="M15.75 8.25V6.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h1.75" />
          </>
        )}
      </svg>
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy email"}
    </button>
  );
}
