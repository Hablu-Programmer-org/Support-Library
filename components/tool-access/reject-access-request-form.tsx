"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { rejectAccessRequestAction } from "@/actions/n8n-requests";
import { PendingSubmitButton } from "@/components/issues/pending-submit-button";
import { nativeSelectClass, nativeTextareaCompactClass } from "@/lib/config/fields";

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
}: {
  requestId: string;
  csrfToken: string;
  onDecisionSaved: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, action] = useActionState(rejectAccessRequestAction, {});

  useEffect(() => {
    if (!state.success) return;
    onDecisionSaved();
    const timer = window.setTimeout(() => router.refresh(), 1_200);
    return () => window.clearTimeout(timer);
  }, [state.success, onDecisionSaved, router]);

  if (!open) {
    return (
      <button
        aria-expanded="false"
        className="inline-flex shrink-0 items-center justify-center rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-400 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
        onClick={() => setOpen(true)}
        type="button"
      >
        Reject
      </button>
    );
  }

  if (state.success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
        <p role="status">{state.success}</p>
        {state.warning && <p role="alert" className="mt-1 text-amber-700 dark:text-amber-300">{state.warning}</p>}
      </div>
    );
  }

  return (
    <form
      action={action}
      className="mt-2 rounded-xl border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-950 dark:bg-rose-950/20"
    >
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="requestId" value={requestId} />
      <div className="grid gap-3 lg:grid-cols-[minmax(180px,0.8fr)_minmax(220px,1fr)_auto] lg:items-end">
        <label className="text-xs font-medium text-slate-700 dark:text-slate-200">
          Rejection reason
          <select
            className={`${nativeSelectClass} mt-1 py-2 text-xs`}
            name="reason"
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          >
            <option value="">Choose a reason</option>
            {REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-700 dark:text-slate-200">
          Internal note <span className="font-normal text-slate-400">(optional, never emailed)</span>
          <textarea
            className={`${nativeTextareaCompactClass} mt-1 min-h-9 py-2 text-xs`}
            maxLength={300}
            name="note"
            placeholder="Context for staff only"
          />
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={() => setOpen(false)}
            type="button"
          >
            Cancel
          </button>
          <PendingSubmitButton
            className="w-auto bg-rose-600 px-3 py-2 text-xs shadow-sm hover:bg-rose-700 disabled:shadow-none"
            disabled={!reason}
            label="Reject & notify"
            pendingLabel="Rejecting…"
          />
        </div>
      </div>
      {state.error && <p role="alert" className="mt-2 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
