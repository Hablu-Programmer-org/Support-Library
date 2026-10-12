"use client";

import { useActionState } from "react";

import {
  publishIssueAction,
  unpublishIssueAction,
  type FormState,
} from "@/actions/issues";
import { PendingSubmitButton } from "@/components/issues/pending-submit-button";

interface PublishFormProps {
  issueId: string;
  reviewedAt: string;
  isPublished: boolean;
  csrfToken?: string;
}

const initialState: FormState = {
  fieldErrors: {},
};

export function PublishIssueForm({ issueId, reviewedAt, isPublished, csrfToken = "" }: PublishFormProps) {
  const publishAction = publishIssueAction.bind(null, issueId);
  const [state, formAction] = useActionState(publishAction, initialState);

  if (isPublished) {
    return (
      <form action={unpublishIssueAction.bind(null, issueId)} className="mt-3">
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <input type="hidden" name="expectedUpdatedAt" value={reviewedAt} />
        <PendingSubmitButton
          label="Remove from library"
          pendingLabel="Removing..."
          variant="secondary"
        />
      </form>
    );
  }

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <input type="hidden" name="reviewedAt" value={reviewedAt} />
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <label className="flex items-start gap-2 cursor-pointer text-sm text-slate-600 dark:text-slate-400">
        <input
          type="checkbox"
          name="reviewConfirmed"
          value="true"
          className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary-500"
        />
        <span>
          I have reviewed this issue and confirmed no student personal information
          (name, email, phone, ID, etc.) is present in the title, problem
          description, or public replies.
        </span>
      </label>
      {state.fieldErrors?.reviewConfirmed && (
        <p className="text-sm text-danger-600 dark:text-danger-400 ml-6" role="alert">
          {state.fieldErrors.reviewConfirmed[0]}
        </p>
      )}
      {state.fieldErrors?._form && (
        <p className="text-sm text-danger-600 dark:text-danger-400" role="alert">
          {state.fieldErrors._form[0]}
        </p>
      )}
      <PendingSubmitButton
        label="Publish to library"
        pendingLabel="Publishing..."
        variant="secondary"
      />
    </form>
  );
}
