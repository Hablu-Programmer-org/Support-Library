import Link from "next/link";

import { CaseFilterPanel } from "@/components/cases/case-filter-panel";
import { StatusBadge } from "@/components/cases/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireSession } from "@/lib/auth-guard";
import { canMutate } from "@/lib/roles";
import { listCaseFilterOptions, listCases } from "@/lib/services/cases";
import { listStaff } from "@/lib/services/staff";
import { CASE_STATUSES } from "@/models";

export const dynamic = "force-dynamic";

const CASE_SORTS = ["newest", "oldest", "priority"] as const;
type CaseSort = (typeof CASE_SORTS)[number];

export default async function CasesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    tag?: string;
    courseSlug?: string;
    batchNo?: string;
    mentorId?: string;
    from?: string;
    to?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const session = await requireSession();
  const page = Number(resolvedSearchParams?.page ?? "1");
  const sort: CaseSort = CASE_SORTS.includes(resolvedSearchParams?.sort as CaseSort)
    ? (resolvedSearchParams?.sort as CaseSort)
    : "newest";

  // The filter schema expects ISO datetimes, but a date input yields YYYY-MM-DD.
  // `from` starts at midnight, `to` ends at end-of-day, both in UTC.
  const from = resolvedSearchParams?.from ? `${resolvedSearchParams.from}T00:00:00.000Z` : undefined;
  const to = resolvedSearchParams?.to ? `${resolvedSearchParams.to}T23:59:59.999Z` : undefined;

  const cases = await listCases({
    q: resolvedSearchParams?.q,
    status: CASE_STATUSES.includes(resolvedSearchParams?.status as never) ? resolvedSearchParams?.status as never : undefined,
    tag: resolvedSearchParams?.tag,
    courseSlug: resolvedSearchParams?.courseSlug || undefined,
    batchNo: resolvedSearchParams?.batchNo ? Number(resolvedSearchParams.batchNo) : undefined,
    mentorId: resolvedSearchParams?.mentorId || undefined,
    from,
    to,
    sort,
    page,
    limit: 20,
  });

  const [{ courseSlugs, batchNos }, staff] = await Promise.all([
    listCaseFilterOptions(),
    listStaff(),
  ]);
  const mentors = staff.filter((member) => member.isActive && (member.role === "MENTOR" || member.role === "ADMIN"));

  const canCreate = Boolean(session.user.role && canMutate(session.user.role));
  const q = resolvedSearchParams?.q ?? "";
  const tag = resolvedSearchParams?.tag ?? "";
  const status = resolvedSearchParams?.status ?? "";
  const courseSlug = resolvedSearchParams?.courseSlug ?? "";
  const batchNo = resolvedSearchParams?.batchNo ?? "";
  const mentorId = resolvedSearchParams?.mentorId ?? "";
  const dateFrom = resolvedSearchParams?.from ?? "";
  const dateTo = resolvedSearchParams?.to ?? "";

  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (tag) params.set("tag", tag);
    if (courseSlug) params.set("courseSlug", courseSlug);
    if (batchNo) params.set("batchNo", batchNo);
    if (mentorId) params.set("mentorId", mentorId);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (sort !== "newest") params.set("sort", sort);
    params.set("page", String(nextPage));
    return `/dashboard/cases?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          canCreate && (
            <Link
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600"
              href="/dashboard/cases/new"
            >
              New Case
            </Link>
          )
        }
        description="Find support cases by problem, tag, status or keyword."
        title="Support Cases"
      />

      <CaseFilterPanel
        batchNos={batchNos}
        courseSlugs={courseSlugs}
        defaults={{ q, tag, status, courseSlug, batchNo, mentorId, dateFrom, dateTo, sort }}
        mentors={mentors}
        statuses={CASE_STATUSES}
      />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="p-0">
          {cases.items.length === 0 ? (
            <EmptyState>No cases found.</EmptyState>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {cases.items.map((supportCase) => (
                <Link
                  key={supportCase.id}
                  href={`/dashboard/cases/${supportCase.id}`}
                  className="block p-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{supportCase.title}</h2>
                        <StatusBadge status={supportCase.status} />
                      </div>
                      <p className="line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{supportCase.question}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {supportCase.studentName || "Unknown student"}
                        {supportCase.studentEmail ? ` · ${supportCase.studentEmail}` : ""}
                      </p>
                    </div>
                    {supportCase.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 sm:max-w-xs sm:justify-end">
                        {supportCase.tags.map((item) => (
                          <span key={item} className="rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                            {item}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>
          Page {cases.page} of {cases.totalPages} · Total {cases.total}
        </span>
        <div className="flex gap-2">
          {cases.page > 1 && (
            <Link
              className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              href={pageHref(cases.page - 1)}
            >
              Previous
            </Link>
          )}
          {cases.page < cases.totalPages && (
            <Link
              className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              href={pageHref(cases.page + 1)}
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
