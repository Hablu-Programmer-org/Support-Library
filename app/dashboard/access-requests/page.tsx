import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { AutoRefresh } from "@/components/shared/auto-refresh";
import { EmptyState } from "@/components/shared/empty-state";
import { AccessRequestRow } from "@/components/tool-access/access-request-row";
import { AccessRequestToolbar } from "@/components/tool-access/access-request-toolbar";
import { CreateAccessRequestPanel } from "@/components/tool-access/create-access-request-panel";
import {
  accessQueueStatuses,
  buildAccessRequestHref,
  parseAccessRequestListState,
  type AccessRequestListState,
  type AccessRequestTab,
} from "@/lib/access-request-list-params";
import { accessHistoryLabel } from "@/lib/access-history-label";
import { requireRole } from "@/lib/auth-guard";
import { generateCsrfToken } from "@/lib/csrf";
import { formatSupportDate, formatSupportShortDate } from "@/lib/format-date";
import { recentlySignedIn } from "@/lib/recent-auth";
import {
  countPendingN8nRequests,
  listAccessRequestBatchNumbers,
  listN8nRequestQueue,
} from "@/lib/services/n8n-requests";
import { requestEntitlementAllowsProcessing } from "@/lib/tool-access-policy";
import { accessTableColumnsClass, secondaryButtonClass } from "@/lib/ui";
import { getAccessRequestActivitySnapshot } from "@/lib/services/access-request-activity";
import type { N8nRequestType } from "@/models";

export const dynamic = "force-dynamic";

type AccessRequest = Awaited<ReturnType<typeof listN8nRequestQueue>>["items"][number];

const TAB_TYPES: Record<AccessRequestTab, N8nRequestType[]> = {
  openai: ["OPENAI_ACCESS"],
  n8n: ["ACCESS", "PASSWORD_RESET"],
};

const TAB_TITLES: Record<AccessRequestTab, string> = {
  openai: "OpenAI API access",
  n8n: "n8n access & password reset",
};

const STATUS_META: Record<
  AccessRequest["status"],
  {
    label: string;
    tone: "waiting" | "processing" | "sent" | "failed" | "muted";
  }
> = {
  PENDING: { label: "Waiting", tone: "waiting" },
  PROCESSING: { label: "Email queued", tone: "processing" },
  SENT: { label: "Sent", tone: "sent" },
  FAILED: { label: "Failed", tone: "failed" },
  REJECTED: { label: "Rejected", tone: "failed" },
  SUPERSEDED: { label: "Superseded", tone: "muted" },
};

const TYPE_LABELS: Record<N8nRequestType, string> = {
  ACCESS: "n8n access",
  PASSWORD_RESET: "Password reset",
  OPENAI_ACCESS: "OpenAI access",
};

function emptyMessage(state: AccessRequestListState) {
  const name = state.tab === "openai" ? "OpenAI" : "n8n";
  const batch = state.batch !== null ? ` for Batch ${state.batch}` : "";
  if (state.q) {
    return `No ${state.showSent ? "" : "pending "}${name} requests${batch} match “${state.q}”.`;
  }
  return state.showSent
    ? `No ${name} requests${batch} yet.`
    : `No pending ${name} requests${batch}.`;
}

function QueueFooter({
  state,
  page,
  total,
  totalPages,
}: {
  state: AccessRequestListState;
  page: number;
  total: number;
  totalPages: number;
}) {
  if (total === 0) return null;
  const pagerClass = `${secondaryButtonClass} px-3 py-1.5 text-xs`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500 dark:text-slate-400">
      <span className="tabular-nums">
        {total} {total === 1 ? "request" : "requests"}
        {state.showSent ? "" : " pending"}
        {totalPages > 1 && ` · Page ${page} of ${totalPages}`}
      </span>
      {totalPages > 1 && (
        <div className="flex gap-2">
          {page > 1 && (
            <Link className={pagerClass} href={buildAccessRequestHref(state, { page: page - 1 })}>
              Previous
            </Link>
          )}
          {page < totalPages && (
            <Link className={pagerClass} href={buildAccessRequestHref(state, { page: page + 1 })}>
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default async function AccessRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole("ADMIN");
  if (!session.user.canManageToolAccess) redirect("/unauthorized");

  const state = parseAccessRequestListState(await searchParams);
  const [requests, batchNumbers, openAiPending, n8nPending, csrfToken, isRecent, activity] = await Promise.all([
    listN8nRequestQueue({
      requestTypes: TAB_TYPES[state.tab],
      statuses: accessQueueStatuses(state.showSent),
      search: state.q,
      batchNo: state.batch,
      page: state.page,
    }),
    listAccessRequestBatchNumbers([...TAB_TYPES.openai, ...TAB_TYPES.n8n]),
    countPendingN8nRequests(TAB_TYPES.openai),
    countPendingN8nRequests(TAB_TYPES.n8n),
    generateCsrfToken(session.user.id),
    recentlySignedIn(session.user.id),
    getAccessRequestActivitySnapshot(),
  ]);

  // A stale link or a deleted last row must land on a real page, not
  // "Page 9 of 1" with dead navigation.
  if (state.page > requests.totalPages) {
    redirect(buildAccessRequestHref(state, { page: requests.totalPages }));
  }

  const variant = state.tab === "openai" ? "openai" : "n8n";

  return (
    <div className="space-y-4">
      <PageHeader
        action={
          <>
            <AutoRefresh
              endpoint="/api/access-requests/activity"
              initialRevision={activity.revision}
              intervalMs={10_000}
              enabled={activity.count > 0}
              idleLabel={activity.count > 0 ? `${activity.count} email queued` : "Queue up to date"}
              status="dot"
            />
            <CreateAccessRequestPanel csrfToken={csrfToken} requiresReauth={!isRecent} />
          </>
        }
        eyebrow="Admin"
        title="Access requests"
      />

      <AccessRequestToolbar
        batches={batchNumbers}
        counts={{ openai: openAiPending, n8n: n8nPending }}
        state={state}
      />

      <section aria-label={TAB_TITLES[state.tab]} className="space-y-3">
        <h2 className="sr-only">{TAB_TITLES[state.tab]}</h2>
        {requests.items.length === 0 ? (
          <EmptyState>{emptyMessage(state)}</EmptyState>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <div
              aria-hidden
              className={`hidden gap-x-4 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 lg:grid dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400 ${accessTableColumnsClass}`}
            >
              <span>Student</span>
              <span>Enrollment</span>
              <span>Access</span>
              <span>Status</span>
              <span className="text-right">Action</span>
            </div>
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {requests.items.map((request) => {
                const status = STATUS_META[request.status];
                const dateLabel =
                  request.status === "SENT" && request.sentAt
                    ? `Sent ${formatSupportDate(request.sentAt)}`
                    : formatSupportDate(request.createdAt);

                return (
                  <AccessRequestRow
                    key={request.id}
                    csrfToken={csrfToken}
                    requiresReauth={!isRecent}
                    request={{
                      id: request.id,
                      typeLabel: TYPE_LABELS[request.requestType],
                      statusLabel: status.label,
                      statusTone: status.tone,
                      dateLabel,
                      studentName: request.student?.name ?? null,
                      studentImage: request.student?.image ?? null,
                      email: request.student?.email ?? null,
                      batchLabel:
                        request.batchNo && request.agentEligible
                          ? `Batch ${request.batchNo}`
                          : request.batchNo
                            ? `Requested Batch ${request.batchNo}`
                            : request.agentEligible
                              ? "Batch unavailable"
                              : null,
                      historyLabel: accessHistoryLabel(
                        request.requestType,
                        request.accessHistory.count,
                        request.accessHistory.lastSentAt,
                      ),
                      createdByEmail: request.createdBy?.email ?? null,
                      variant,
                      canApprove: request.agentEligible &&
                        (request.status === "PENDING" || request.status === "FAILED") &&
                        requestEntitlementAllowsProcessing(
                          request.requestType,
                          request.entitlement?.state ?? null,
                        ),
                      canReject: request.status === "PENDING" || request.status === "FAILED",
                      rejectionNotificationFailed:
                        request.status === "REJECTED" && request.rejectionEmailStatus === "FAILED",
                      firstRequestedLabel: `Requested ${formatSupportShortDate(request.accessHistory.firstRequestedAt) ?? "unknown"}`,
                      enrollmentLabel: request.currentBatchNo && request.currentBatchNo !== request.batchNo
                        ? `Now Batch ${request.currentBatchNo}`
                        : request.agentEligible
                          ? "Enrollment active"
                          : request.batchNo
                            ? "Enrollment inactive"
                            : "No enrollment",
                      entitlementLabel: request.entitlement
                        ? request.entitlement.state === "ACTIVE"
                          ? `Access until ${formatSupportShortDate(request.entitlement.expiresAt) ?? "unknown"}`
                          : request.entitlement.state === "EXPIRED"
                            ? `Expired ${formatSupportShortDate(request.entitlement.expiresAt) ?? "unknown"}`
                            : "Access revoked"
                        : request.status === "REJECTED"
                          ? "Not granted"
                          : "No prior access",
                    }}
                  />
                );
              })}
            </ul>
          </div>
        )}

        <QueueFooter
          page={requests.page}
          state={state}
          total={requests.total}
          totalPages={requests.totalPages}
        />
      </section>
    </div>
  );
}
