import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { AccessRequestRow } from "@/components/tool-access/access-request-row";
import { AccessRequestToolbar } from "@/components/tool-access/access-request-toolbar";
import { AdminCreateAccessRequestForm } from "@/components/tool-access/admin-create-access-request-form";
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
import { isN8nAdmin } from "@/lib/n8n-request-policy";
import { recentlySignedIn } from "@/lib/recent-auth";
import {
  countPendingN8nRequests,
  listAccessRequestBatchNumbers,
  listN8nRequestQueue,
} from "@/lib/services/n8n-requests";
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
  PROCESSING: { label: "Processing", tone: "processing" },
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

function QueuePagination({
  state,
  page,
  totalPages,
  total,
}: {
  state: AccessRequestListState;
  page: number;
  totalPages: number;
  total: number;
}) {
  return (
    <div className="flex items-center justify-between px-1 text-xs text-slate-500 dark:text-slate-400">
      <span>
        {total} {total === 1 ? "request" : "requests"}
        {totalPages > 1 ? ` · Page ${page} of ${totalPages}` : ""}
      </span>
      {totalPages > 1 && (
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 font-medium transition hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
              href={buildAccessRequestHref(state, { page: page - 1 })}
            >
              Previous
            </Link>
          )}
          {page < totalPages && (
            <Link
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 font-medium transition hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
              href={buildAccessRequestHref(state, { page: page + 1 })}
            >
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
  if (!(await isN8nAdmin(session.user.email))) redirect("/unauthorized");

  const state = parseAccessRequestListState(await searchParams);
  const [requests, batchNumbers, openAiPending, n8nPending, csrfToken, isRecent] = await Promise.all([
    listN8nRequestQueue({
      requestTypes: TAB_TYPES[state.tab],
      statuses: accessQueueStatuses(state.showSent),
      search: state.q,
      batchNo: state.batch,
      page: state.page,
    }),
    listAccessRequestBatchNumbers(TAB_TYPES[state.tab]),
    countPendingN8nRequests(TAB_TYPES.openai),
    countPendingN8nRequests(TAB_TYPES.n8n),
    generateCsrfToken(session.user.id),
    recentlySignedIn(session.user.id),
  ]);

  // A stale link or a deleted last row must land on a real page, not
  // "Page 9 of 1" with dead navigation.
  if (state.page > requests.totalPages) {
    redirect(buildAccessRequestHref(state, { page: requests.totalPages }));
  }

  const variant = state.tab === "openai" ? "openai" : "n8n";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Access requests"
        description="AI Agent course students only. Copy the email, then confirm OpenAI access or send the n8n link. API keys are never accepted, stored or emailed."
      />

      <AdminCreateAccessRequestForm csrfToken={csrfToken} requiresReauth={!isRecent} />

      <AccessRequestToolbar
        batches={batchNumbers}
        counts={{ openai: openAiPending, n8n: n8nPending }}
        state={state}
      />

      <section aria-label={TAB_TITLES[state.tab]} className="space-y-2">
        {requests.items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
            {emptyMessage(state)}
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
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
                      request.entitlement === null,
                    canReject: request.status === "PENDING" || request.status === "FAILED",
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
        )}

        <QueuePagination
          page={requests.page}
          state={state}
          total={requests.total}
          totalPages={requests.totalPages}
        />
      </section>
    </div>
  );
}