import { Skeleton } from "@/components/shared/skeleton";

export default function LiveSupportLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 py-8" aria-busy="true" aria-label="Loading">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-4 rounded-xl lg:order-last">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-16" />
          <Skeleton className="h-11" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
    </div>
  );
}
