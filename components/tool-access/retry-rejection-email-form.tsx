"use client";

import { useActionState } from "react";

import { retryRejectionEmailAction } from "@/actions/n8n-requests";
import { PendingSubmitButton } from "@/components/issues/pending-submit-button";
import { GoogleReverifyButton } from "@/components/tool-access/google-reverify-button";

export function RetryRejectionEmailForm({
  requestId,
  csrfToken,
  requiresReauth,
}: {
  requestId: string;
  csrfToken: string;
  requiresReauth: boolean;
}) {
  const [state, action] = useActionState(retryRejectionEmailAction, {});
  const needsReauth = requiresReauth || state.errorCode === "REAUTH_REQUIRED";
  return (
    <form action={action} className="flex flex-wrap items-center justify-end gap-2">
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="requestId" value={requestId} />
      {needsReauth ? (
        <GoogleReverifyButton />
      ) : (
        <PendingSubmitButton
          label="Retry notification"
          pendingLabel="Queueing…"
          fullWidth={false}
          className="inline-flex items-center justify-center rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-60 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/30"
        />
      )}
      {state.error && <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>}
      {state.success && <p className="text-xs text-emerald-700 dark:text-emerald-400">{state.success}</p>}
    </form>
  );
}
