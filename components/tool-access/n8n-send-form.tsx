"use client";

import { useActionState, useState } from "react";

import { sendN8nLinkAction } from "@/actions/n8n-requests";
import { SendIcon } from "@/components/icons";
import { PendingSubmitButton } from "@/components/issues/pending-submit-button";
import { GoogleReverifyButton } from "@/components/tool-access/google-reverify-button";
import { nativeFieldClass } from "@/lib/config/fields";

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
  const [link, setLink] = useState("");
  const needsReauth = requiresReauth || state.errorCode === "REAUTH_REQUIRED";

  return (
    <form action={action} className="min-w-0">
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="requestId" value={requestId} />
      <div className="flex min-w-0 items-center justify-end gap-2 max-[359px]:flex-col max-[359px]:items-stretch">
        {needsReauth ? (
          <GoogleReverifyButton />
        ) : (
          <>
            <label className="sr-only" htmlFor={`link-${requestId}`}>n8n link</label>
            <input
              id={`link-${requestId}`}
              name="link"
              type="url"
              required
              autoComplete="off"
              placeholder="Paste secure n8n link…"
              className={`${nativeFieldClass} min-w-0 flex-1 px-3 py-2 text-xs`}
              value={link}
              onChange={(event) => setLink(event.target.value)}
            />
            <PendingSubmitButton
              className="w-auto shrink-0 px-3 py-2 text-xs shadow-sm disabled:shadow-none"
              disabled={!link.trim()}
              label="Send email"
              leadingIcon={<SendIcon size={14} />}
              pendingLabel="Sending…"
            />
          </>
        )}
      </div>
      {state.error && <p role="alert" className="mt-1.5 text-xs text-red-600">{state.error}</p>}
      {state.success && <p role="status" className="mt-1.5 text-xs text-emerald-600">{state.success}</p>}
    </form>
  );
}
