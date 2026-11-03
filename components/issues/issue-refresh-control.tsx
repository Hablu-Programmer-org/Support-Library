"use client";

import { AutoRefresh } from "@/components/shared/auto-refresh";

/**
 * Keeps the staff issue queue current without polling the expensive list query.
 * The 20s probe reads only `{revision, count}`; a changed revision refreshes
 * the RSC payload in place.
 */
export function IssueRefreshControl({ initialRevision }: { initialRevision: string }) {
  return (
    <AutoRefresh
      endpoint="/api/issues/activity"
      initialRevision={initialRevision}
      intervalMs={20_000}
    />
  );
}
