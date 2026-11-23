import { Skeleton } from "@/components/shared/skeleton";

const card =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900/70";

/**
 * Shaped like the student create page: header; the details card (title,
 * editor with its toolbar, screenshots), the course card, the optional
 * disclosure and submit; the "Before you submit" checklist beside it.
 */
export default function NewIssueLoading() {
  return (
    <div className="w-full py-6" aria-busy="true" aria-label="Loading">
      <div className="mb-8 space-y-5">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-9 w-60" />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-10">
        <div className="order-2 min-w-0 space-y-6 lg:order-1">
          <div className={`${card} space-y-5`}>
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-11" />
            <div className="flex items-end justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-11 w-36" />
            </div>
            <Skeleton className="h-72" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
          <div className={`${card} space-y-4`}>
            <Skeleton className="h-5 w-36" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
            </div>
          </div>
          <Skeleton className="h-14 rounded-2xl" />
        </div>
        <div className={`order-1 lg:order-2 ${card} space-y-3`}>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="h-4 w-3/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      </div>
    </div>
  );
}
