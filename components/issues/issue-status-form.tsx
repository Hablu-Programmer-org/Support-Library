"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { changeIssueStatusAction, type FormState } from "@/actions/issues";
import type { CaseStatus } from "@/lib/constants";
import { nativeSelectClass } from "@/lib/config/fields";

const INITIAL_STATE: FormState = {};

function PendingHint() {
  const { pending } = useFormStatus();

  return (
    // Takes no room while idle (`empty:sr-only`) but stays in the DOM, so the
    // live region still announces "Updating status…".
    <p aria-live="polite" className="text-xs text-slate-500 empty:sr-only dark:text-slate-400">
      {pending ? "Updating status…" : ""}
    </p>
  );
}

/**
 * Status picker that saves as soon as a value is chosen.
 *
 * Mentors were selecting a status and then having to press a separate button,
 * which is easy to forget — the change looked saved while the issue was still on
 * the old status. Choosing from the list now submits the same server action, so
 * the optimistic-revision check, the rate limit and the audit row all still
 * apply. The submit button stays in the DOM for a browser without JavaScript.
 *
 * Every value, `SOLVED` included, only changes the status. Publishing lives on
 * the separate publish form (admin only, with its PII review).
 *
 * A rejected save (rate limit, a stale revision) reports its reason under the
 * picker instead of replacing the page with the error boundary.
 */
export function IssueStatusForm({
  issueId,
  status,
  expectedUpdatedAt,
  csrfToken,
  options,
}: {
  issueId: string;
  status: CaseStatus;
  expectedUpdatedAt: string;
  csrfToken: string;
  options: Array<{ value: CaseStatus; label: string }>;
}) {
  const [state, formAction] = useActionState(
    changeIssueStatusAction.bind(null, issueId),
    INITIAL_STATE,
  );
  const statusError = state.fieldErrors?._form?.[0] ?? state.fieldErrors?.status?.[0];

  return (
    <form
      action={formAction}
      className="mt-4 space-y-2"
    >
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} />

      <label
        htmlFor="issue-status"
        className="block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        Status
      </label>
      <select
        // Re-sync the picker when the server-confirmed status changes, so a
        // failed save cannot leave a value selected that was never stored. A
        // rejected save flips the key too, which puts the stored value back.
        key={`${status}-${statusError ? "failed" : "saved"}`}
        id="issue-status"
        name="status"
        defaultValue={status}
        className={nativeSelectClass}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {statusError && (
        <p role="alert" className="text-sm text-danger-700 dark:text-danger-600">
          {statusError}
        </p>
      )}

      <PendingHint />

      <button type="submit" className="sr-only">
        Update status
      </button>
    </form>
  );
}
