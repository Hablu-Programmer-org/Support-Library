"use client";

import { useActionState, useState } from "react";

import { createN8nRequestAction } from "@/actions/n8n-requests";
import { PendingSubmitButton } from "@/components/issues/pending-submit-button";

export function OpenAiRequestForm({ csrfToken }: { csrfToken: string }) {
  const [state, action] = useActionState(createN8nRequestAction, {});
  const [purpose, setPurpose] = useState("");
  return <form action={action} className="space-y-4">
    <input type="hidden" name="csrfToken" value={csrfToken} />
    <input type="hidden" name="requestType" value="OPENAI_ACCESS" />
    <div>
      <label className="text-sm font-semibold" htmlFor="openai-purpose">What do you want to build?</label>
      <textarea
        id="openai-purpose"
        name="purpose"
        required
        minLength={10}
        maxLength={300}
        rows={3}
        value={purpose}
        onChange={(event) => setPurpose(event.target.value)}
        placeholder="For example: an invoice automation workflow for my batch project"
        className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-cyan-500 dark:border-slate-700"
      />
      <p className="mt-1 text-right text-xs text-slate-500">{purpose.length}/300</p>
    </div>
    <p className="text-xs text-slate-500">We send a workspace invitation only. API keys are never sent by email.</p>
    {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-emerald-600">{state.success}</p>}
    <div className="max-w-xs"><PendingSubmitButton label="Request OpenAI access" pendingLabel="Sending request…" /></div>
  </form>;
}
