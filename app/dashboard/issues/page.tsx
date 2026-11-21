import { deleteIssueAction } from "@/actions/issues";
import { DeleteButton } from "@/components/issues/delete-button";
import Link from "next/link";
import { redirect } from "next/navigation";

import { IssueFilterPanel } from "@/components/issues/issue-filter-panel";
import { SearchTimeoutNotice } from "@/components/issues/search-timeout-notice";
import { IssueRefreshControl } from "@/components/issues/issue-refresh-control";
import { buildIssueCardStaff, IssueCard } from "@/components/issues/issue-card";
import { IssuesHero } from "@/components/issues/issues-hero";
import {
  IssueListPagination,
  NoIssuesState,
  NoResultsState,
} from "@/components/issues/issue-list-states";
import { QuickLiveSupportButton } from "@/components/live-support/quick-live-support-button";
import { PageHeader } from "@/components/shared/page-header";
import { AccessHelpCard } from "@/components/tool-access/access-help-card";
import { requireSession } from "@/lib/auth-guard";
import { currentShift, dayKeyInDhaka } from "@/lib/config/live-support";
import type { CaseStatus } from "@/lib/constants";
import { generateCsrfToken } from "@/lib/csrf";
import {
  buildIssueDetailHref,
  buildIssueListHref,
  hasActiveIssueFilters,
  parseIssueListFilters,
  resolveDefaultIssueSort,
  toIssueDateRange,
} from "@/lib/issue-list-params";
import { isLiveSupportConfigured } from "@/lib/live-support";
import { canCreateIssue, canMutate } from "@/lib/roles";
import { agentEnrollmentAllows } from "@/lib/agent-enrollment-rules";
import { getIssueActivitySnapshot } from "@/lib/services/issue-activity";
import { listIssueFilterOptions, listIssues, SearchTimeoutError } from "@/lib/services/issues";
import { listJoinIssueIdsForDay } from "@/lib/services/live-support-joins";
import { getStudentAgentEnrollment, listOwnN8nRequests, listOwnToolEntitlements } from "@/lib/services/n8n-requests";
import { listAssignableMentors } from "@/lib/services/staff";
import { toolEntitlementState } from "@/lib/tool-access-policy";
import { CASE_STATUSES } from "@/models";

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

  // One parser for the URL state: it drops invalid values (so `?page=abc` or
  // `?status=NOPE` render the default list instead of throwing) and produces the
  // exact shape the filter panel and the detail page's `returnTo` use.
  const filters = parseIssueListFilters(resolvedSearchParams, { canManage });
  const defaultSort = resolveDefaultIssueSort({ canManage, q: filters.q });
  const { from, to } = toIssueDateRange(filters);

  let issues: Awaited<ReturnType<typeof listIssues>>;
  let searchFailed = false;
  try {
    issues = await listIssues(
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
  } catch (error) {
    if (!(error instanceof SearchTimeoutError)) throw error;
    // A slow index is a recoverable condition, not a broken dashboard: render a
    // notice with the way out instead of the generic error boundary.
    searchFailed = true;
    issues = { items: [], page: 1, limit: 20, total: 0, totalPages: 1 };
  }

  // A stale link, a typo, or deleting the only row on the last page leaves no
  // rows to show. Send the viewer to the last real page instead of rendering
  // "Page 99 of 3" with dead Previous/Next buttons.
  if (issues.total > 0 && filters.page > issues.totalPages) {
    redirect(
      buildIssueListHref(filters, { page: issues.totalPages, defaultSort }),
    );
  }

  const [{ courseSlugs, batchNos, tags }, mentors, waitingIssueIds] =
    await Promise.all([
      listIssueFilterOptions(publicOnly),
      canManage ? listAssignableMentors() : Promise.resolve([]),
      canManage
        ? listJoinIssueIdsForDay(dayKeyInDhaka(new Date()))
        : Promise.resolve([] as string[]),
    ]);
  const waitingIds = new Set(waitingIssueIds);

  const canDelete = canManage; // Same roles can delete
  // Students also get the request-less quick join beside "Create an issue";
  // staff run the room from `/dashboard/support`, so they keep just "New Issue".
  const showQuickJoin = canSubmit && !canManage;
  // One token covers both student actions; staff never see the quick join.
  const csrfToken =
    canDelete || showQuickJoin ? await generateCsrfToken(session.user.id) : "";
  const agentAccess = showQuickJoin
    ? await getStudentAgentEnrollment(session.user.id)
    : null;
  const accessRequests =
    showQuickJoin && agentEnrollmentAllows(agentAccess)
      ? await listOwnN8nRequests(session.user.id)
      : [];
  const toolEntitlements =
    showQuickJoin && agentEnrollmentAllows(agentAccess)
      ? await listOwnToolEntitlements(session.user.id)
      : [];
  const entitlementFor = (tool: "N8N" | "OPENAI") => {
    const row = toolEntitlements.find((entitlement) => entitlement.tool === tool);
    if (!row) return null;
    return {
      state: toolEntitlementState(row),
      expiresAt: row.expiresAt.toISOString(),
      revokedAt: row.revokedAt?.toISOString() ?? null,
    };
  };
  const accessEntitlements = {
    n8n: entitlementFor("N8N"),
    openai: entitlementFor("OPENAI"),
  };
  const activity = canManage ? await getIssueActivitySnapshot() : null;
  // Both are resolved here, server-side: the browser clock is display only and
  // the room URL never leaves the action.
  const quickJoinShift = showQuickJoin ? currentShift(new Date()) : "off";
  const quickJoinConfigured = showQuickJoin ? isLiveSupportConfigured() : false;

  // The list URL travelling with every row: a detail page hands it back so
  // "Back to results" (and every action that redirects) returns to this exact
  // filter/page instead of resetting to page 1.
  const listHref = buildIssueListHref(filters, { defaultSort });
  const returnTo =
    hasActiveIssueFilters(filters, defaultSort) || filters.page > 1
      ? listHref
      : undefined;

  // Same buttons in both headers; the role only changes the surrounding layout.
  const headerActions = canSubmit && (
    <div className="flex flex-wrap items-end gap-2">
      {/* The quick-join control owns a status line above its button. Align
          the action children by their bottom edge so Submit and Join keep
          one button baseline instead of centring Submit against both rows. */}
      <Link
        className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600 cursor-pointer"
        href="/dashboard/issues/new"
      >
        {canManage ? "New Issue" : "Create an issue"}
      </Link>
      {showQuickJoin && (
        <QuickLiveSupportButton
          configured={quickJoinConfigured}
          csrfToken={csrfToken}
          shift={quickJoinShift}
        />
      )}
      {canManage && activity && (
        <IssueRefreshControl initialRevision={activity.revision} />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {canManage ? (
        <PageHeader
          action={headerActions}
          description="Find support issues by problem, tag, status or keyword."
          title="Support Issues"
        />
      ) : (
        <IssuesHero
          actions={headerActions}
          description="Search first — issues can be submitted 24/7, live support runs only during a shift."
          tags={tags.map((tag) => ({
            tag,
            active: filters.tag === tag,
            href: buildIssueListHref(
              { ...filters, tag: filters.tag === tag ? "" : tag, page: 1 },
              { defaultSort },
            ),
          }))}
          title="Student Support Library"
        />
      )}

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
        floating={!canManage}
        mentors={mentors}
        showMentor={canManage}
        statuses={CASE_STATUSES}
        summary={
          searchFailed
            ? "Search is temporarily unavailable."
            : filters.q
              ? `${issues.total} result${issues.total === 1 ? "" : "s"} for “${filters.q}”`
              : `Total ${issues.total} issue${issues.total === 1 ? "" : "s"}`
        }
      />

      {showQuickJoin && agentEnrollmentAllows(agentAccess) && (
        <AccessHelpCard
          csrfToken={csrfToken}
          entitlements={accessEntitlements}
          requests={accessRequests.map((request) => ({
            id: request._id.toString(),
            requestType: request.requestType,
            status: request.status,
            sentAt: request.sentAt?.toISOString() ?? null,
          }))}
        />
      )}

      <section>
        {issues.items.length === 0 ? (
          searchFailed ? (
            <SearchTimeoutNotice
              href={buildIssueListHref(
                { ...filters, q: "", page: 1 },
                { defaultSort },
              )}
            />
          ) : filters.q ? (
            <NoResultsState
              clearHref={buildIssueListHref(
                { ...filters, q: "", page: 1 },
                { defaultSort },
              )}
              query={filters.q}
              tags={tags.map((tag) => ({
                tag,
                href: buildIssueListHref(
                  { ...filters, q: "", tag, page: 1 },
                  { defaultSort },
                ),
              }))}
            />
          ) : (
            <NoIssuesState />
          )
        ) : (
          <ul className="space-y-3" aria-label="Issues">
            {issues.items.map((supportIssue, index) => (
              <li key={supportIssue.id}>
                <IssueCard
                  enterIndex={index}
                  actions={
                    canDelete && (
                      <DeleteButton
                        action={deleteIssueAction.bind(null, supportIssue.id)}
                        csrfToken={csrfToken}
                        className="shrink-0"
                        returnTo={listHref}
                      />
                    )
                  }
                  batchNo={supportIssue.batchNo}
                  courseSlug={supportIssue.courseSlug}
                  href={buildIssueDetailHref(supportIssue.id, returnTo)}
                  question={supportIssue.question}
                  staff={buildIssueCardStaff(supportIssue, { canManage, waitingIds })}
                  status={supportIssue.status}
                  tags={supportIssue.tags}
                  title={supportIssue.title}
                  updatedAt={supportIssue.updatedAt ?? supportIssue.createdAt}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <IssueListPagination
        hrefFor={(page) => buildIssueListHref(filters, { page, defaultSort })}
        page={issues.page}
        total={issues.total}
        totalPages={issues.totalPages}
      />
    </div>
  );
}
