"use client";

import { useActionState } from "react";

import { createAccessRequestsForStudentAction } from "@/actions/n8n-requests";
import { PendingSubmitButton } from "@/components/issues/pending-submit-button";

const choices = [
  ["ACCESS", "n8n access"],
  ["PASSWORD_RESET", "n8n password reset"],
  ["OPENAI_ACCESS", "OpenAI API access"],
] as const;

export function AdminCreateAccessRequestForm({ csrfToken }: { csrfToken: string }) {
  const [state, action] = useActionState(createAccessRequestsForStudentAction, {});
  return <section aria-labelledby="admin-create-access-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <h2 id="admin-create-access-heading" className="text-lg font-semibold">Create requests manually</h2>
    <p className="mt-1 text-sm text-slate-500">Enter the Hablu Programmer account email and choose one or more access types.</p>
    <form action={action} className="mt-5 space-y-4">
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <div>
        <label className="text-sm font-semibold" htmlFor="manual-access-email">Student email</label>
        <input
          id="manual-access-email"
          name="email"
          type="email"
          required
          autoComplete="off"
          placeholder="student@example.com"
          className="mt-2 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-cyan-500 dark:border-slate-700"
        />
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">Access to request</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {choices.map(([value, label]) => <label key={value} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm has-checked:border-cyan-500 has-checked:bg-cyan-50 dark:border-slate-700 dark:has-checked:bg-cyan-950/30">
            <input type="checkbox" name="requestTypes" value={value} />
            <span className="font-medium">{label}</span>
          </label>)}
        </div>
      </fieldset>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p role="status" className="text-sm text-emerald-600">{state.success}</p>}
      <div className="max-w-xs"><PendingSubmitButton label="Create selected requests" pendingLabel="Creating requests…" /></div>
    </form>
  </section>;
}
