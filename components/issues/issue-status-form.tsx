"use client";

import { useFormStatus } from "react-dom";

import { changeIssueStatusActionSimple } from "@/actions/issues";
import type { CaseStatus } from "@/lib/constants";
import { nativeSelectClass } from "@/lib/config/fields";

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
  return (
    <form
      action={changeIssueStatusActionSimple.bind(null, issueId)}
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
        // failed save cannot leave a value selected that was never stored.
        key={status}
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

      <PendingHint />

      <button type="submit" className="sr-only">
        Update status
      </button>
    </form>
  );
}
