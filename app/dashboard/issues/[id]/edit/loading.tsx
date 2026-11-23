import { Skeleton } from "@/components/shared/skeleton";
import { surfaceClass } from "@/lib/ui";
import { cn } from "@/lib/cn";

/** Mirrors the edit layout: action bar, Manage, issue + media, side cards. */
export default function EditIssueLoading() {
  return (
    <div className="w-full pb-10" aria-busy="true" aria-label="Loading">
      <div className="-mx-4 mb-6 flex flex-wrap items-center gap-4 border-b border-slate-200 px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 dark:border-slate-800">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Skeleton className="h-10 flex-1 sm:w-20 sm:flex-none" />
          <Skeleton className="h-10 flex-1 sm:w-32 sm:flex-none" />
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-x-10">
        <div className={cn(surfaceClass, "space-y-4 p-5 lg:col-start-2 lg:row-start-1")}>
          <Skeleton className="h-3 w-16" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </div>

        <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <div className={cn(surfaceClass, "space-y-5 p-5 sm:p-6")}>
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-16" />
            <Skeleton className="h-64" />
          </div>
          <div className={cn(surfaceClass, "space-y-5 p-5 sm:p-6")}>
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-36" />
            <Skeleton className="h-20" />
          </div>
        </div>

        <div className="space-y-6 lg:col-start-2 lg:row-start-2">
          <div className={cn(surfaceClass, "space-y-4 p-5")}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
          <div className={cn(surfaceClass, "space-y-4 p-5")}>
            <Skeleton className="h-3 w-28" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
