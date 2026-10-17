import { Skeleton } from "@/components/shared/skeleton";

export default function SubmittedLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 text-center" aria-busy="true" aria-label="Loading">
      <Skeleton className="mx-auto h-14 w-14 rounded-full" />
      <Skeleton className="mx-auto mt-4 h-7 w-64" />
      <Skeleton className="mx-auto mt-3 h-4 w-72" />
      <div className="mt-8 flex justify-center gap-3">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-48" />
      </div>
    </div>
  );
}
