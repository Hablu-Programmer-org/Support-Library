import Link from "next/link";
import { deleteIssueActionSimple } from "@/actions/issues";
import { DeleteButton } from "@/components/issues/delete-button";

import { IssueFilterPanel } from "@/components/issues/issue-filter-panel";
import { StatusBadge } from "@/components/issues/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireSession } from "@/lib/auth-guard";
import { canCreateIssue, canMutate } from "@/lib/roles";
import { LIVE_SUPPORT_ELIGIBLE_STATUSES } from "@/lib/constants";
import { dayKeyInDhaka } from "@/lib/config/live-support";
import { listIssueFilterOptions, listIssues } from "@/lib/services/issues";
import { listJoinIssueIdsForDay } from "@/lib/services/live-support-joins";
import { listAssignableMentors } from "@/lib/services/staff";
import { CASE_STATUSES } from "@/models";
import { generateCsrfToken } from "@/lib/csrf";

export const dynamic = "force-dynamic";

const ISSUE_SORTS = ["newest", "oldest", "priority"] as const;
type IssueSort = (typeof ISSUE_SORTS)[number];

export default async function IssuesPage({
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
  // Staff-level rights decide whether unpublished issues, student PII and the
  // staff filters are visible — students must never pass this check.
  const canManage = Boolean(session.user.role && canMutate(session.user.role));
  // Submitting a request is a separate, narrower right that students also hold.
  const canSubmit = canCreateIssue(session.user.role);
  const publicOnly = !canManage;
  const page = Number(resolvedSearchParams?.page ?? "1");
  const sort: IssueSort = ISSUE_SORTS.includes(
    resolvedSearchParams?.sort as IssueSort,
  )
    ? (resolvedSearchParams?.sort as IssueSort)
    : "newest";

  // The filter schema expects ISO datetimes, but a date input yields YYYY-MM-DD.
  // `from` starts at midnight, `to` ends at end-of-day, both in UTC.
  const from = resolvedSearchParams?.from
    ? `${resolvedSearchParams.from}T00:00:00.000Z`
    : undefined;
  const to = resolvedSearchParams?.to
    ? `${resolvedSearchParams.to}T23:59:59.999Z`
    : undefined;

  const issues = await listIssues(
    {
      q: resolvedSearchParams?.q,
      status: CASE_STATUSES.includes(resolvedSearchParams?.status as never)
        ? (resolvedSearchParams?.status as never)
        : undefined,
      tag: resolvedSearchParams?.tag,
      courseSlug: resolvedSearchParams?.courseSlug || undefined,
      batchNo: resolvedSearchParams?.batchNo
        ? Number(resolvedSearchParams.batchNo)
        : undefined,
      mentorId: canManage
        ? resolvedSearchParams?.mentorId || undefined
        : undefined,
      from,
      to,
      sort,
      page,
      limit: 20,
    },
    { publicOnly },
  );

  const [{ courseSlugs, batchNos }, mentors, waitingIssueIds] = await Promise.all([
    listIssueFilterOptions(publicOnly),
    canManage ? listAssignableMentors() : Promise.resolve([]),
    canManage
      ? listJoinIssueIdsForDay(dayKeyInDhaka(new Date()))
      : Promise.resolve([] as string[]),
  ]);
  const waitingIds = new Set(waitingIssueIds);

  const canDelete = canManage; // Same roles can delete
  const csrfToken = canDelete ? await generateCsrfToken(session.user.id) : "";
  const q = resolvedSearchParams?.q ?? "";
  const tag = resolvedSearchParams?.tag ?? "";
  const status = resolvedSearchParams?.status ?? "";
  const courseSlug = resolvedSearchParams?.courseSlug ?? "";
  const batchNo = resolvedSearchParams?.batchNo ?? "";
  const mentorId = canManage ? (resolvedSearchParams?.mentorId ?? "") : "";
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
    return `/dashboard/issues?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          canSubmit && (
            <Link
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600 cursor-pointer"
              href="/dashboard/issues/new"
            >
              {canManage ? "New Issue" : "Submit an issue"}
            </Link>
          )
        }
        description="Find support issues by problem, tag, status or keyword."
        title={canManage ? "Support Issues" : "Student Support Library"}
      />

      <IssueFilterPanel
        batchNos={batchNos}
        courseSlugs={courseSlugs}
        defaults={{
          q,
          tag,
          status,
          courseSlug,
          batchNo,
          mentorId,
          dateFrom,
          dateTo,
          sort,
        }}
        mentors={mentors}
        showMentor={canManage}
        statuses={CASE_STATUSES}
      />

      <section className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {issues.items.length === 0 ? (
          <EmptyState>No issues found.</EmptyState>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {issues.items.map((supportIssue) => (
              <div
                key={supportIssue.id}
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                  <Link
                    href={`/dashboard/issues/${supportIssue.id}`}
                    className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between flex-1 min-w-0"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{supportIssue.title}</h2>
                        <StatusBadge status={supportIssue.status} />
                        {waitingIds.has(supportIssue.id) &&
                          LIVE_SUPPORT_ELIGIBLE_STATUSES.includes(
                            supportIssue.status as (typeof LIVE_SUPPORT_ELIGIBLE_STATUSES)[number],
                          ) && (
                            <span className="rounded-full bg-success-100 px-2 py-1 text-xs font-semibold text-success-700 dark:bg-success-950/50 dark:text-success-300">
                              Waiting in live support
                            </span>
                          )}
                      </div>
                      <p className="line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                        {supportIssue.question}
                      </p>
                      {canManage && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {supportIssue.studentName || "Unknown student"}
                          {supportIssue.studentEmail
                            ? ` · ${supportIssue.studentEmail}`
                            : ""}
                        </p>
                      )}
                    </div>
                    {supportIssue.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 sm:max-w-xs sm:justify-end">
                        {supportIssue.tags.map((item) => (
                          <span
                            key={item}
                            className="rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                  {canDelete && (
                    <DeleteButton
                      action={deleteIssueActionSimple.bind(
                        null,
                        supportIssue.id,
                      )}
                      csrfToken={csrfToken}
                      className="shrink-0"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>
          Page {issues.page} of {issues.totalPages} · Total {issues.total}
        </span>
        <div className="flex gap-2">
          {issues.page > 1 && (
            <Link
              className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              href={pageHref(issues.page - 1)}
            >
              Previous
            </Link>
          )}
          {issues.page < issues.totalPages && (
            <Link
              className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              href={pageHref(issues.page + 1)}
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
