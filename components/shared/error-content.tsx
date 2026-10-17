"use client";

import { useEffect } from "react";

type ErrorContentProps = {
  error: Error & { digest?: string };
  reset: () => void;
  /**
   * Shown under the heading. Must stay generic: `error.message` from a
   * server action can contain internal detail (e.g. a raw Zod dump),
   * so it is logged here and never rendered.
   */
  message: string;
};

export function ErrorContent({ error, reset, message }: ErrorContentProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="w-full max-w-md p-6 text-center">
      <div className="flex flex-col items-center">
        <h1 className="text-2xl font-bold text-danger">Something Went Wrong</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
      </div>
      <div className="mt-6">
        <button onClick={reset} type="button" className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600">
          Try Again
        </button>
      </div>
    </section>
  );
}
