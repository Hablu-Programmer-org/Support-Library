"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { rejectAccessRequestAction } from "@/actions/n8n-requests";
import { PendingSubmitButton } from "@/components/issues/pending-submit-button";
import {
  nativeSelectClass,
  nativeTextareaCompactClass,
} from "@/lib/config/fields";

const REASONS = [
  ["ACCESS_PERIOD_EXPIRED", "Access period expired"],
  ["BATCH_NOT_ELIGIBLE", "Batch is not eligible"],
  ["ALREADY_GRANTED", "Access was already provided"],
  ["ENROLLMENT_INACTIVE", "Course enrollment is inactive"],
  ["DUPLICATE_REQUEST", "Duplicate request"],
  ["ACCOUNT_UNAVAILABLE", "Account is unavailable"],
  ["OTHER", "Other"],
] as const;

export function RejectAccessRequestForm({
  requestId,
  csrfToken,
  onDecisionSaved,
  onCancel,
}: {
  requestId: string;
  csrfToken: string;
  onDecisionSaved: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const reasonRef = useRef<HTMLSelectElement>(null);
  const [reason, setReason] = useState("");
  const [state, action, isPending] = useActionState(
    rejectAccessRequestAction,
    {},
  );

  useEffect(() => {
    reasonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!state.success) return;
    onDecisionSaved();
    router.refresh();
  }, [state.success, onDecisionSaved, router]);

  if (state.success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
        <p role="status">{state.success}</p>
        {state.warning && (
          <p role="alert" className="mt-1 text-amber-700 dark:text-amber-300">
            {state.warning}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      action={action}
      aria-busy={isPending}
      className="w-full min-w-0 rounded-xl border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-950 dark:bg-rose-950/20"
    >
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="requestId" value={requestId} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(180px,0.8fr)_minmax(220px,1fr)_auto] lg:items-end">
        <label className="text-xs font-medium text-slate-700 dark:text-slate-200">
          Internal note{" "}
          <span className="font-normal text-slate-400">
            (optional, never emailed)
          </span>
          <textarea
            className={`${nativeTextareaCompactClass} mt-1 min-h-9 py-2 text-xs`}
            maxLength={300}
            name="note"
            placeholder="Context for staff only"
          />
        </label>
        <label className="min-w-0 text-xs font-medium text-slate-700 dark:text-slate-200">
          Rejection reason
          <select
            ref={reasonRef}
            className={`${nativeSelectClass} mt-1 py-2 text-xs`}
            name="reason"
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          >
            <option value="">Choose a reason</option>
            {REASONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-nowrap items-center justify-end gap-2 max-sm:flex-wrap">
          <button
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            disabled={isPending}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <PendingSubmitButton
            className="bg-rose-600 px-3 py-2 text-xs shadow-sm hover:bg-rose-700 disabled:shadow-none"
            disabled={!reason}
            fullWidth={false}
            label="Reject & notify"
            pendingLabel="Rejecting…"
          />
        </div>
      </div>
      {state.error && (
        <p role="alert" className="mt-2 wrap-break-word text-xs text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
