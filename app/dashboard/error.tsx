"use client";

import { ErrorContent } from "@/components/shared/error-content";

/**
 * Dashboard-scoped error boundary. Because it lives in app/dashboard/
 * it renders inside the dashboard layout, so the header and navigation
 * stay available while only the broken child is replaced by this card.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <ErrorContent error={error} reset={reset} message="We could not load this page." />
    </div>
  );
}
