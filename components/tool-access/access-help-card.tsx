"use client";

import { useActionState } from "react";

import { createN8nRequestAction } from "@/actions/n8n-requests";
import { PendingSubmitButton } from "@/components/issues/pending-submit-button";

type RequestSummary = {
  id: string;
  requestType: "ACCESS" | "PASSWORD_RESET" | "OPENAI_ACCESS";
  status: "PENDING" | "PROCESSING" | "SENT" | "FAILED";
  sentAt?: string | null;
};

const choices = [
  {
    value: "ACCESS",
    label: "n8n access",
    hint: "I need an invitation to start using n8n.",
  },
  {
    value: "PASSWORD_RESET",
    label: "n8n password reset",
    hint: "I cannot sign in and need a reset link.",
  },
  {
    value: "OPENAI_ACCESS",
    label: "OpenAI API access",
    hint: "Invitation only — no API key is emailed.",
  },
] as const;

const active = (status: RequestSummary["status"]) => status === "PENDING" || status === "PROCESSING";

function statusLabel(status: RequestSummary["status"], sentAt?: string | null): React.ReactNode {
  switch (status) {
    case "PENDING":
    case "PROCESSING":
      return <span className="text-[10px] text-cyan-700 dark:text-cyan-300">Waiting for the team</span>;
    case "SENT":
      return sentAt ? (
        <>
          ✓ Email sent ·{" "}
          {new Date(sentAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </>
      ) : (
        "✓ Email sent"
      );
    case "FAILED":
      return <span className="text-[10px] text-red-700 dark:text-red-300">Failed — request again</span>;
    default:
      return null;
  }
}

export function AccessHelpCard({ csrfToken, requests }: { csrfToken: string; requests: RequestSummary[] }) {
  const [state, action] = useActionState(createN8nRequestAction, {});

  const sentRequest = requests.find((r) => r.status === "SENT");

  return (
    <section aria-labelledby="access-help-heading" className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <h2 id="access-help-heading" className="text-sm font-semibold">
          Help & access
        </h2>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 hidden sm:inline">
          OpenAI is invitation only — no API key is emailed.
        </span>
      </div>
      <form action={action} className="space-y-3">
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <fieldset className="flex flex-wrap gap-2" aria-label="Choose access requests">
          <legend className="sr-only">Choose access requests</legend>
          {choices.map((choice) => {
            const latest = requests.find((request) => request.requestType === choice.value);
            const isActive = Boolean(latest && active(latest.status));
            return (
              <label
                key={choice.value}
                className="flex items-center gap-2 min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs has-checked:border-cyan-500 has-checked:bg-cyan-50 dark:border-slate-700 dark:has-checked:bg-cyan-950/30 cursor-pointer"
                title={choice.hint}
              >
                <input className="mt-0.5 shrink-0" type="checkbox" name="requestTypes" value={choice.value} disabled={isActive} />
                <span className="truncate font-medium">{choice.label}</span>
                {latest && <span className="ml-auto shrink-0">{statusLabel(latest.status, latest.sentAt)}</span>}
              </label>
            );
          })}
        </fieldset>
        {state.error && <p role="alert" className="text-xs text-red-600">{state.error}</p>}
        {state.success && <p role="status" className="text-xs text-emerald-600">{state.success}</p>}
        {sentRequest && (
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            Check your inbox and Spam/Promotions for the secure link. n8n links expire — use it soon.
          </p>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 pt-1">
          <PendingSubmitButton label="Send selected requests" pendingLabel="Sending…" className="w-full sm:w-auto" />
        </div>
      </form>
    </section>
  );
}