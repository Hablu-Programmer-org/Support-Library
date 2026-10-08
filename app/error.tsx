"use client";

import { ErrorContent } from "@/components/shared/error-content";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <ErrorContent error={error} reset={reset} message="অপ্রত্যাশিত একটি ত্রুটি ঘটেছে।" />
    </div>
  );
}