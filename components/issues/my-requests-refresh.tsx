"use client";

import { AutoRefresh } from "@/components/shared/auto-refresh";

/**
 * Keeps "My requests" and an open request current while the student waits.
 *
 * Staff replies already bump the issue's `updatedAt` (and its position in the
 * list), so a 10s probe of the student-scoped revision is enough to pull the
 * new answer into the RSC payload without a socket or a full-list poll. The
 * endpoint is scoped by the session — it cannot report another student.
 */
export function MyRequestsRefresh({ initialRevision }: { initialRevision: string }) {
  return (
    <AutoRefresh
      endpoint="/api/my-requests/activity"
      initialRevision={initialRevision}
      intervalMs={10_000}
    />
  );
}
