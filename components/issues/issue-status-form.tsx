"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { changeIssueStatusAction, type FormState } from "@/actions/issues";
import { PendingSubmitButton } from "@/components/issues/pending-submit-button";
import type { CaseStatus } from "@/lib/constants";
import { nativeSelectClass } from "@/lib/config/fields";

const INITIAL_STATE: FormState = {};

function PendingHint() {
  const { pending } = useFormStatus();

  return (
    <p aria-live="polite" className="min-h-4 text-xs text-slate-500 dark:text-slate-400">
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
 * `SOLVED` is the one value that also publishes (admin only). Because
 * publication still needs the same PII review as the publish form, choosing it
 * swaps the auto-submit for a short confirmation plus an explicit
 * `Save and publish` button.
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
  autoPublish = false,
  isPublished = false,
}: {
  issueId: string;
  status: CaseStatus;
  expectedUpdatedAt: string;
  csrfToken: string;
  options: Array<{ value: CaseStatus; label: string }>;
  /** The viewer may publish, so solving can publish without a second trip. */
  autoPublish?: boolean;
  /** Already in the library: solving only changes the status. */
  isPublished?: boolean;
}) {
  const [confirmingSolve, setConfirmingSolve] = useState(false);
  const [state, formAction] = useActionState(
    changeIssueStatusAction.bind(null, issueId),
    INITIAL_STATE,
  );
  const needsConfirmation = autoPublish && !isPublished;
  const statusError = state.fieldErrors?._form?.[0] ?? state.fieldErrors?.status?.[0];

  return (
    <form
      action={formAction}
      className="mt-3 space-y-2"
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
        onChange={(event) => {
          if (needsConfirmation && event.currentTarget.value === "SOLVED") {
            setConfirmingSolve(true);
            return;
          }
          setConfirmingSolve(false);
          event.currentTarget.form?.requestSubmit();
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {statusError && (
        <p role="alert" className="text-sm text-danger-700 dark:text-danger-300">
          {statusError}
        </p>
      )}

      {confirmingSolve && needsConfirmation && (
        <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <label className="flex items-start gap-2 cursor-pointer text-sm text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              name="publishConfirmed"
              value="true"
              required
              className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary-500"
            />
            <span>No student personal information in this issue.</span>
          </label>
          <PendingSubmitButton
            label="Save and publish"
            pendingLabel="Saving…"
            variant="secondary"
          />
        </div>
      )}

      <PendingHint />

      {!confirmingSolve && (
        <button type="submit" className="sr-only">
          Update status
        </button>
      )}
    </form>
  );
}
