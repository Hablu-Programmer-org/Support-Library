"use client";

import { useActionState } from "react";

import { sendN8nLinkAction } from "@/actions/n8n-requests";
import { PendingSubmitButton } from "@/components/issues/pending-submit-button";

export function N8nSendForm({ requestId, csrfToken, provider = "n8n" }: { requestId: string; csrfToken: string; provider?: "n8n" | "OpenAI" }) {
  const [state, action] = useActionState(sendN8nLinkAction, {});
  return (
    <form action={action} className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="requestId" value={requestId} />
      <label className="block text-sm font-semibold" htmlFor={`link-${requestId}`}>{provider} invitation or reset link</label>
      <input
        id={`link-${requestId}`}
        name="link"
        type="url"
        required
        autoComplete="off"
        placeholder={provider === "n8n" ? "https://your-n8n-domain/..." : "https://platform.openai.com/..."}
        className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-cyan-500 dark:border-slate-700"
      />
      <p className="text-xs text-slate-500">The link is emailed immediately and is never saved in the database.</p>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p role="status" className="text-sm text-emerald-600">{state.success}</p>}
      <div className="max-w-xs"><PendingSubmitButton label="Send email" pendingLabel="Sending securely…" /></div>
    </form>
  );
}
