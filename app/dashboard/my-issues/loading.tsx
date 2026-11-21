import { Skeleton } from "@/components/shared/skeleton";

const panel =
  "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70";

/**
 * Mirrors the loaded page (header, four count tiles, issue cards) with the
 * same wrapper, gaps and padding, so the swap to real content does not jump.
 */
export default function MyIssuesLoading() {
  return (
    <div aria-busy="true" className="w-full space-y-6 py-6" role="status">
      <span className="sr-only">Loading my issues</span>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Skeleton className="h-8 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-11 w-28" />
          <Skeleton className="h-11 w-32" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className={`flex min-h-24 flex-col justify-between gap-3 p-4 ${panel}`}
            data-testid="my-issues-tile-skeleton"
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-10" />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className={`flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:p-5 ${panel}`}
            data-testid="my-issues-row-skeleton"
          >
            <Skeleton className="size-11 shrink-0 self-start rounded-xl" />
            <div className="min-w-0 flex-[999_1_15rem] space-y-2.5">
              <Skeleton className="h-5 w-3/4 max-w-md" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-3.5 w-1/2 max-w-xs" />
            </div>
            <Skeleton className="h-10 flex-[1_0_auto] sm:w-28 sm:flex-none" />
          </div>
        ))}
      </div>
    </div>
  );
}
