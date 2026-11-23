import { Skeleton } from "@/components/shared/skeleton";
import { surfaceClass, surfaceHeaderClass } from "@/lib/ui";

function CardSkeleton({ rows, rowClass = "h-5" }: { rows: number; rowClass?: string }) {
  return (
    <div className={surfaceClass}>
      <div className={surfaceHeaderClass}>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="px-4 py-3">
            <Skeleton className={rowClass} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mirrors the overview: header, 4 KPI cards, work queue + side rail. */
export default function DashboardOverviewLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-44" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-2xl" />
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <CardSkeleton rows={5} />
          <Skeleton className="h-[120px] rounded-2xl" />
        </div>
        <div className="space-y-5">
          <CardSkeleton rows={3} rowClass="h-10" />
          <CardSkeleton rows={2} />
        </div>
      </div>
    </div>
  );
}
