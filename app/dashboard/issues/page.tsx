import Link from "next/link";
import { redirect } from "next/navigation";
import { deleteIssueAction } from "@/actions/issues";
import { DeleteButton } from "@/components/issues/delete-button";

import { IssueFilterPanel } from "@/components/issues/issue-filter-panel";
import { IssueRefreshControl } from "@/components/issues/issue-refresh-control";
import { StatusBadge } from "@/components/issues/status-badge";
import { QuickLiveSupportButton } from "@/components/live-support/quick-live-support-button";
import { AccessHelpCard } from "@/components/n8n/access-help-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireSession } from "@/lib/auth-guard";
import { canCreateIssue, canMutate } from "@/lib/roles";
import { LIVE_SUPPORT_ELIGIBLE_STATUSES, type CaseStatus } from "@/lib/constants";
import { currentShift, dayKeyInDhaka } from "@/lib/config/live-support";
import { isLiveSupportConfigured } from "@/lib/live-support";
import {
  buildIssueDetailHref,
  buildIssueListHref,
  hasActiveIssueFilters,
  parseIssueListFilters,
  toIssueDateRange,
} from "@/lib/issue-list-params";
import { listIssueFilterOptions, listIssues } from "@/lib/services/issues";
import { listJoinIssueIdsForDay } from "@/lib/services/live-support-joins";
import { listAssignableMentors } from "@/lib/services/staff";
import { CASE_STATUSES } from "@/models";
import { generateCsrfToken } from "@/lib/csrf";
import { listOwnN8nRequests } from "@/lib/services/n8n-requests";
import { getIssueActivitySnapshot } from "@/lib/services/issue-activity";

export const dynamic = "force-dynamic";

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
  const defaultSort = canManage ? "answer" : "newest";

  // One parser for the URL state: it drops invalid values (so `?page=abc` or
  // `?status=NOPE` render the default list instead of throwing) and produces the
  // exact shape the filter panel and the detail page's `returnTo` use.
  const filters = parseIssueListFilters(resolvedSearchParams, { canManage });
  const { from, to } = toIssueDateRange(filters);

  const issues = await listIssues(
    {
      q: filters.q || undefined,
      status: filters.status ? (filters.status as CaseStatus) : undefined,
      tag: filters.tag || undefined,
      courseSlug: filters.courseSlug || undefined,
      batchNo: filters.batchNo ? Number(filters.batchNo) : undefined,
      mentorId: filters.mentorId || undefined,
      from,
      to,
      sort: filters.sort,
      page: filters.page,
      limit: 20,
    },
    { publicOnly },
  );

  // A stale link, a typo, or deleting the only row on the last page leaves no
  // rows to show. Send the viewer to the last real page instead of rendering
  // "Page 99 of 3" with dead Previous/Next buttons.
  if (issues.total > 0 && filters.page > issues.totalPages) {
    redirect(buildIssueListHref(filters, { page: issues.totalPages, defaultSort }));
  }

  const [{ courseSlugs, batchNos }, mentors, waitingIssueIds] = await Promise.all([
    listIssueFilterOptions(publicOnly),
    canManage ? listAssignableMentors() : Promise.resolve([]),
    canManage
      ? listJoinIssueIdsForDay(dayKeyInDhaka(new Date()))
      : Promise.resolve([] as string[]),
  ]);
  const waitingIds = new Set(waitingIssueIds);

  const canDelete = canManage; // Same roles can delete
  // Students also get the request-less quick join beside "Submit an issue";
  // staff run the room from `/dashboard/support`, so they keep just "New Issue".
  const showQuickJoin = canSubmit && !canManage;
  // One token covers both student actions; staff never see the quick join.
  const csrfToken =
    canDelete || showQuickJoin ? await generateCsrfToken(session.user.id) : "";
  const accessRequests = showQuickJoin
    ? await listOwnN8nRequests(session.user.id)
    : [];
  const activity = canManage ? await getIssueActivitySnapshot() : null;
  // Both are resolved here, server-side: the browser clock is display only and
  // the room URL never leaves the action.
  const quickJoinShift = showQuickJoin ? currentShift(new Date()) : "off";
  const quickJoinConfigured = showQuickJoin ? isLiveSupportConfigured() : false;

  // The list URL travelling with every row: a detail page hands it back so
  // "Back to results" (and every action that redirects) returns to this exact
  // filter/page instead of resetting to page 1.
  const listHref = buildIssueListHref(filters, { defaultSort });
  const returnTo = hasActiveIssueFilters(filters, defaultSort) || filters.page > 1 ? listHref : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          canSubmit && (
            <div className="flex flex-wrap items-end gap-2">
              {/* The quick-join control owns a status line above its button. Align
                  the action children by their bottom edge so Submit and Join keep
                  one button baseline instead of centring Submit against both rows. */}
              <Link
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600 cursor-pointer"
                href="/dashboard/issues/new"
              >
                {canManage ? "New Issue" : "Submit an issue"}
              </Link>
              {showQuickJoin && (
                <QuickLiveSupportButton
                  configured={quickJoinConfigured}
                  csrfToken={csrfToken}
                  shift={quickJoinShift}
                />
              )}
              {canManage && activity && <IssueRefreshControl initialRevision={activity.revision} />}
            </div>
          )
        }
        description={
          canManage
            ? "Find support issues by problem, tag, status or keyword."
            : "Search first — requests can be submitted 24/7, live support runs only during a shift."
        }
        title={canManage ? "Support Issues" : "Student Support Library"}
      />

      <IssueFilterPanel
        batchNos={batchNos}
        courseSlugs={courseSlugs}
        defaults={{
          q: filters.q,
          tag: filters.tag,
          status: filters.status,
          courseSlug: filters.courseSlug,
          batchNo: filters.batchNo,
          mentorId: filters.mentorId,
          from: filters.from,
          to: filters.to,
          sort: filters.sort,
        }}
        mentors={mentors}
        showMentor={canManage}
        statuses={CASE_STATUSES}
      />

      {showQuickJoin && (
        <AccessHelpCard
          csrfToken={csrfToken}
          requests={accessRequests.map((request) => ({
            id: request._id.toString(),
            requestType: request.requestType,
            status: request.status,
            sentAt: request.sentAt?.toISOString() ?? null,
          }))}
        />
      )}

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
                    href={buildIssueDetailHref(supportIssue.id, returnTo)}
                    className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between flex-1 min-w-0"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="line-clamp-2 wrap-break-word font-semibold">{supportIssue.title}</h2>
                        <StatusBadge status={supportIssue.status} />
                        {canManage && "awaitingStaff" in supportIssue && supportIssue.awaitingStaff !== false && (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                            {"lastStaffReplyAt" in supportIssue && supportIssue.lastStaffReplyAt
                              ? "Student replied"
                              : "No reply yet"}
                          </span>
                        )}
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
                          {"caseRef" in supportIssue && supportIssue.caseRef && (
                            <>
                              <span className="font-mono font-semibold">
                                {supportIssue.caseRef}
                              </span>
                              {" · "}
                            </>
                          )}
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
                      action={deleteIssueAction.bind(
                        null,
                        supportIssue.id,
                      )}
                      csrfToken={csrfToken}
                      className="shrink-0"
                      returnTo={listHref}
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
              href={buildIssueListHref(filters, { page: issues.page - 1, defaultSort })}
            >
              Previous
            </Link>
          )}
          {issues.page < issues.totalPages && (
            <Link
              className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              href={buildIssueListHref(filters, { page: issues.page + 1, defaultSort })}
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
