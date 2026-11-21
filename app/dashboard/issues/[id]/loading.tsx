import { Skeleton } from "@/components/shared/skeleton";

const card =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900/70";

/** Shaped like the case page: header, Issue details, a response, the context card. */
export default function IssueDetailLoading() {
  return (
    <div className="w-full py-6" aria-busy="true" aria-label="Loading">
      <div className="mb-8 space-y-3">
        <Skeleton className="mb-5 h-5 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-10">
        <div className="min-w-0 space-y-10">
          <div className={`${card} space-y-3`}>
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-4" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-3 w-24" />
            <div className={`${card} space-y-3`}>
              <div className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-full" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-4" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
        </div>
        <div className={`${card} space-y-4`}>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-6 w-24" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        </div>
      </div>
    </div>
  );
}
