"use client";

import { useFormStatus } from "react-dom";

import { TrashIcon } from "@/components/icons";

export function ArchiveIssueButton({ action, csrfToken }: { action: (formData: FormData) => Promise<void>; csrfToken: string }) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Archive this issue? It will disappear from active lists.")) event.preventDefault();
      }}
    >
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <ArchiveSubmitButton />
    </form>
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
