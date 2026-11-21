import { Skeleton } from "@/components/shared/skeleton";

const ISSUE_LIST_SKELETON_CARDS = 6;

/**
 * Shaped like the student page (most visitors): the hero with its title, tag
 * pills and the search card inside it, the summary line, then the card list.
 * The search card uses the hero's real bottom padding so nothing jumps when the
 * page swaps in. Staff see the same outline for a moment before their header.
 */
function HeroSkeleton() {
  return (
    <div
      data-testid="issues-hero-skeleton"
      className="rounded-3xl border border-slate-200 bg-white px-5 pb-4 pt-7 sm:px-8 sm:pt-9 dark:border-slate-800 dark:bg-slate-900/60"
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-9 w-64 max-w-full sm:h-10 sm:w-80" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {[40, 44, 76, 96, 68, 56, 64, 88].map((width, i) => (
          <Skeleton key={i} className="h-6 rounded-full" style={{ width }} />
        ))}
      </div>
      {/* The search card: 54px bar + chips row, inset like the real one. */}
      <div className="mt-6 rounded-[22px] border border-slate-200 p-2 sm:-mx-2 dark:border-slate-800">
        <Skeleton className="h-[54px] rounded-2xl" />
        <div className="mt-2 flex h-8 items-center gap-1.5 px-1">
          {[40, 52, 60, 64, 76].map((width) => (
            <Skeleton key={width} className="h-7 rounded-full" style={{ width }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Same outline as `IssueCard` (radius, accent strip, three rows). */
function IssueCardSkeleton() {
  return (
    <div
      data-testid="issue-card-skeleton"
      className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white py-4 pl-5 pr-4 dark:border-slate-800 dark:bg-slate-900/70"
    >
      <span className="absolute inset-y-0 left-0 w-1 bg-slate-200 dark:bg-slate-700" />
      <div className="flex items-start gap-3">
        <Skeleton className="h-5 flex-1 sm:max-w-md" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-2.5 h-4 w-full" />
      <Skeleton className="mt-1.5 h-4 w-2/3" />
      <div className="mt-3 flex items-center gap-2">
        <Skeleton className="h-5 w-14 rounded-md" />
        <Skeleton className="h-5 w-20 rounded-md" />
        <Skeleton className="ml-auto h-4 w-12" />
      </div>
    </div>
  );
}

export default function IssuesLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <HeroSkeleton />
      <Skeleton className="h-4 w-32" />
      <div className="space-y-3">
        {Array.from({ length: ISSUE_LIST_SKELETON_CARDS }, (_, i) => (
          <IssueCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
