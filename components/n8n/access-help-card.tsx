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
  { value: "ACCESS", label: "n8n access", hint: "Add me as a member so I can use n8n." },
  { value: "PASSWORD_RESET", label: "n8n password reset", hint: "Send a secure link so I can choose a new password." },
  { value: "OPENAI_ACCESS", label: "OpenAI API access", hint: "Add me as a member for OpenAI API access. No API key is emailed." },
] as const;

const active = (status: RequestSummary["status"]) => status === "PENDING" || status === "PROCESSING";

export function AccessHelpCard({ csrfToken, requests }: { csrfToken: string; requests: RequestSummary[] }) {
  const [state, action] = useActionState(createN8nRequestAction, {});

  return <section aria-labelledby="access-help-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div className="mb-5">
      <h2 id="access-help-heading" className="text-lg font-semibold">Help &amp; access</h2>
      <p className="mt-1 text-sm text-slate-500">Select one or more. Each access link will be sent separately to your registered email.</p>
    </div>
    <form action={action} className="space-y-4">
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <fieldset className="space-y-2">
        <legend className="sr-only">Choose access requests</legend>
        {choices.map((choice) => {
          const latest = requests.find((request) => request.requestType === choice.value);
          const isActive = Boolean(latest && active(latest.status));
          return <label key={choice.value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 has-checked:border-cyan-500 has-checked:bg-cyan-50 dark:border-slate-700 dark:has-checked:bg-cyan-950/30">
            <input className="mt-1" type="checkbox" name="requestTypes" value={choice.value} disabled={isActive} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 font-semibold">
                {choice.label}
                {isActive && <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">{latest?.status}</span>}
                {!isActive && latest?.status === "SENT" && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Previously sent</span>}
              </span>
              <span className="mt-1 block text-sm text-slate-500">{isActive ? "The support team is already processing this request." : choice.hint}</span>
            </span>
          </label>;
        })}
      </fieldset>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p role="status" className="text-sm text-emerald-600">{state.success}</p>}
      <div className="max-w-xs"><PendingSubmitButton label="Send selected requests" pendingLabel="Sending requests…" /></div>
    </form>
  </section>;
}
