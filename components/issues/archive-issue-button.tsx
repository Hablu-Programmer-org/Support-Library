"use client";

import { useTransition } from "react";

import { TrashIcon } from "@/components/icons";

export function ArchiveIssueButton({ action }: { action: () => Promise<unknown> }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Archive this issue? It will disappear from active lists.")) return;
        startTransition(async () => {
          await action();
        });
      }}
      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-danger-100 px-4 py-2.5 text-sm font-semibold text-danger-700 transition hover:bg-danger-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-danger-950/60 dark:text-danger-200 dark:hover:bg-danger-900/60"
    >
      <TrashIcon size={17} />
      {pending ? "Archiving..." : "Archive issue"}
    </button>
  );
}
