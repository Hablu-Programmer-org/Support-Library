"use client";

import { useRef } from "react";

import { CloseIcon } from "@/components/icons";
import { AdminCreateAccessRequestForm } from "@/components/tool-access/admin-create-access-request-form";
import { primaryButtonClass } from "@/lib/ui";

/**
 * Header button + right-side slide-over for manual request creation.
 *
 * Native `<dialog>` + `showModal()`: focus is trapped and restored to the
 * button, Escape closes it, and the queue behind stays visible but inert.
 */
export function CreateAccessRequestPanel({
  csrfToken,
  requiresReauth,
}: {
  csrfToken: string;
  requiresReauth: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button
        aria-haspopup="dialog"
        className={`${primaryButtonClass} min-h-11`}
        onClick={() => dialogRef.current?.showModal()}
        type="button"
      >
        <svg
          aria-hidden
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Create request
      </button>

      <dialog
        aria-labelledby="create-access-title"
        className="my-0 mr-0 ml-auto h-dvh max-h-dvh w-full max-w-md border-l border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
        // A click on the backdrop lands on the dialog element itself.
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        ref={dialogRef}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-3 dark:border-slate-800">
            <h2 id="create-access-title" className="text-base font-semibold">
              Create requests manually
            </h2>
            <button
              aria-label="Close"
              className="-mr-2 inline-flex size-11 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-cyan-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              onClick={close}
              type="button"
            >
              <CloseIcon aria-hidden size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <AdminCreateAccessRequestForm csrfToken={csrfToken} requiresReauth={requiresReauth} />
          </div>
        </div>
      </dialog>
    </>
  );
}
