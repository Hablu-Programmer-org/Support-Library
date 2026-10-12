"use client";

import { TrashIcon } from "@/components/icons";

type DeleteButtonProps = {
  action: (formData: FormData) => Promise<void>;
  csrfToken: string;
  disabled?: boolean;
  className?: string;
};

export function DeleteButton({ action, csrfToken, disabled = false, className = "" }: DeleteButtonProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!window.confirm("Are you sure you want to delete this issue?")) {
      e.preventDefault();
      return;
    }
  };

  return (
    <form action={action} onSubmit={handleSubmit} className={className}>
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <button
        type="submit"
        disabled={disabled}
        className="inline-flex items-center justify-center rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-danger-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-danger-400 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Delete issue"
      >
        <TrashIcon size={18} />
      </button>
    </form>
  );
}
