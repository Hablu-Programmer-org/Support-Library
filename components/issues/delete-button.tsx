"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { FormState } from "@/actions/issues";
import { TrashIcon } from "@/components/icons";

const INITIAL_STATE: FormState = {};

/**
 * Row-level delete/archive button.
 *
 * The action is state-based, so a rejected delete (rate limit, missing
 * permission, a case that is already gone) shows its reason next to the button
 * instead of replacing the whole list with the error boundary.
 */
export function DeleteButton({
  action,
  csrfToken,
  disabled = false,
  className = "",
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  csrfToken: string;
  disabled?: boolean;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  const error = state.fieldErrors?._form?.[0];

  return (
    <div className={className}>
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!window.confirm("Are you sure you want to delete this issue?")) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <DeleteSubmitButton disabled={disabled} />
      </form>
      {error && (
        <p role="alert" className="mt-1 max-w-xs text-xs text-danger-700 dark:text-danger-300">
          {error}
        </p>
      )}
    </div>
  );
}

function DeleteSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className="inline-flex items-center justify-center rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-danger-600 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-danger-400"
      aria-label="Delete issue"
    >
      <TrashIcon size={18} />
    </button>
  );
}
