"use client";

import { useActionState } from "react";

import { createN8nRequestAction } from "@/actions/n8n-requests";
import { PendingSubmitButton } from "@/components/issues/pending-submit-button";

export function N8nRequestForm({ csrfToken }: { csrfToken: string }) {
  const [state, action] = useActionState(createN8nRequestAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Choose n8n help</legend>
        <label className="cursor-pointer rounded-xl border border-slate-200 p-4 has-checked:border-cyan-500 has-checked:bg-cyan-50 dark:border-slate-700 dark:has-checked:bg-cyan-950/30">
          <input className="mr-2" type="radio" name="requestType" value="ACCESS" required />
          <span className="font-semibold">n8n access</span>
          <span className="mt-1 block text-sm text-slate-500">I need an invitation to start using n8n.</span>
        </label>
        <label className="cursor-pointer rounded-xl border border-slate-200 p-4 has-checked:border-cyan-500 has-checked:bg-cyan-50 dark:border-slate-700 dark:has-checked:bg-cyan-950/30">
          <input className="mr-2" type="radio" name="requestType" value="PASSWORD_RESET" required />
          <span className="font-semibold">Reset password</span>
          <span className="mt-1 block text-sm text-slate-500">I cannot sign in and need a reset link.</span>
        </label>
      </fieldset>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p role="status" className="text-sm text-emerald-600">{state.success}</p>}
      <div className="max-w-xs"><PendingSubmitButton label="Send request" pendingLabel="Sending request…" /></div>
    </form>
  );
}
