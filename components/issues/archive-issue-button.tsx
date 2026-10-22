"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { FormState } from "@/actions/issues";
import { TrashIcon } from "@/components/icons";

const INITIAL_STATE: FormState = {};

/**
 * Archive button for the danger zone.
 *
 * State-based like the row delete button: a rejected archive reports its reason
 * under the button instead of taking the whole case page down with it.
 */
export function ArchiveIssueButton({
  action,
  csrfToken,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  csrfToken: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  const error = state.fieldErrors?._form?.[0];

  return (
    <>
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!window.confirm("Archive this issue? It will disappear from active lists.")) event.preventDefault();
        }}
      >
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <ArchiveSubmitButton />
      </form>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger-700 dark:text-danger-300">
          {error}
        </p>
      )}
    </>
  );
}

function ArchiveSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-danger-700 bg-danger-600 px-4 py-3 text-sm font-bold text-white transition-[transform,background-color] hover:bg-danger-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500 focus-visible:ring-offset-2 focus-visible:ring-offset-danger-50 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 dark:border-danger-400 dark:bg-danger-300 dark:text-danger-900 dark:hover:bg-danger-400 dark:focus-visible:ring-danger-600 dark:focus-visible:ring-offset-slate-900"
    >
      <TrashIcon size={17} />
      {pending ? "Archiving..." : "Archive issue"}
    </button>
  );
}
