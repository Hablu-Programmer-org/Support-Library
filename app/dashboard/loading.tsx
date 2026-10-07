/**
 * Dashboard-wide loading fallback. It renders inside the dashboard
 * layout, so the header stays visible and only the content area
 * shows a skeleton while a route is fetching. Every dashboard route
 * is `force-dynamic`, so this appears on each navigation instead of
 * the UI freezing with no feedback.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="লোড হচ্ছে">
      {/* Page title skeleton */}
      <div className="flex flex-col gap-3">
        <div className="h-8 w-48 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
        <div className="h-4 w-72 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
      </div>

      {/* Stat card skeletons */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-slate-200 dark:border-slate-700 dark:bg-slate-700"
          />
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-slate-200 dark:border-slate-700 dark:bg-slate-700" />
    </div>
  );
}