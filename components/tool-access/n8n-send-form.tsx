"use client";

import { useActionState } from "react";

import { sendN8nLinkAction } from "@/actions/n8n-requests";
import { PendingSubmitButton } from "@/components/issues/pending-submit-button";
import { GoogleReverifyButton } from "@/components/tool-access/google-reverify-button";

export function N8nSendForm({
  requestId,
  csrfToken,
  requiresReauth = false,
}: {
  requestId: string;
  csrfToken: string;
  requiresReauth?: boolean;
}) {
  const [state, action] = useActionState(sendN8nLinkAction, {});

  return (
    <form action={action} className="mt-2 space-y-2 border-t border-slate-200 pt-2 dark:border-slate-800">
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="requestId" value={requestId} />
      <label className="block text-xs font-semibold" htmlFor={`link-${requestId}`}>
        n8n invitation or reset link
      </label>
      <input
        id={`link-${requestId}`}
        name="link"
        type="url"
        required
        autoComplete="off"
        placeholder="https://your-n8n-domain/..."
        className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-cyan-500 dark:border-slate-700"
      />
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Emailed immediately and never stored in the database.
      </p>
      {state.error && <p role="alert" className="text-xs text-red-600">{state.error}</p>}
      {state.success && <p role="status" className="text-sm text-emerald-600">{state.success}</p>}
      <div className="max-w-xs">
        {requiresReauth || state.errorCode === "REAUTH_REQUIRED" ? (
          <GoogleReverifyButton />
        ) : (
          <PendingSubmitButton label="Send email" pendingLabel="Sending securely…" className="w-auto px-3 py-2 text-xs" />
        )}
      </div>
    </form>
  );
}
