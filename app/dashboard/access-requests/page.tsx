import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { AccessRequestToolbar } from "@/components/tool-access/access-request-toolbar";
import { AdminCreateAccessRequestForm } from "@/components/tool-access/admin-create-access-request-form";
import { CopyEmailButton } from "@/components/tool-access/copy-email-button";
import { N8nSendForm } from "@/components/tool-access/n8n-send-form";
import { OpenAiConfirmForm } from "@/components/tool-access/openai-confirm-form";
import {
  accessQueueStatuses,
  buildAccessRequestHref,
  parseAccessRequestListState,
  type AccessRequestListState,
  type AccessRequestTab,
} from "@/lib/access-request-list-params";
import { requireRole } from "@/lib/auth-guard";
import { generateCsrfToken } from "@/lib/csrf";
import { formatSupportDate } from "@/lib/format-date";
import { isN8nAdmin } from "@/lib/n8n-request-policy";
import { recentlySignedIn } from "@/lib/recent-auth";
import {
  countPendingN8nRequests,
  listN8nRequestQueue,
} from "@/lib/services/n8n-requests";
import type { N8nRequestType } from "@/models";

export const dynamic = "force-dynamic";

type AccessRequest = Awaited<ReturnType<typeof listN8nRequestQueue>>["items"][number];
type Status = AccessRequest["status"];

const TAB_TYPES: Record<AccessRequestTab, N8nRequestType[]> = {
  openai: ["OPENAI_ACCESS"],
  n8n: ["ACCESS", "PASSWORD_RESET"],
};

const TAB_META: Record<
  AccessRequestTab,
  { title: string; accent: string; form: "openai" | "n8n" }
> = {
  openai: {
    title: "OpenAI API access",
    accent: "bg-emerald-500",
    form: "openai",
  },
  n8n: {
    title: "n8n access & password reset",
    accent: "bg-cyan-500",
    form: "n8n",
  },
};

const STATUS_STYLES: Record<Status, { pill: string; dot: string; label: string }> = {
  PENDING: {
    pill: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
    dot: "bg-amber-500",
    label: "Waiting",
  },
  PROCESSING: {
    pill: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900",
    dot: "bg-sky-500",
    label: "Processing",
  },
  SENT: {
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
    dot: "bg-emerald-500",
    label: "Sent",
  },
  FAILED: {
    pill: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900",
    dot: "bg-red-500",
    label: "Failed",
  },
  SUPERSEDED: {
    pill: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
    dot: "bg-slate-400",
    label: "Superseded",
  },
};

const TYPE_LABELS: Record<AccessRequest["requestType"], string> = {
  ACCESS: "n8n access",
  PASSWORD_RESET: "Password reset",
  OPENAI_ACCESS: "OpenAI access",
};

function StatusPill({ status }: { status: Status }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${style.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden />
      {style.label}
    </span>
  );
}

function RequestCard({
  request,
  csrfToken,
  variant,
  requiresReauth,
  accent,
}: {
  request: AccessRequest;
  csrfToken: string;
  variant: "openai" | "n8n";
  requiresReauth: boolean;
  accent: string;
}) {
  const email = request.student?.email ?? null;
  const actionable = request.status === "PENDING" || request.status === "FAILED";
  const dateLabel =
    request.status === "SENT" && request.sentAt
      ? `Sent ${formatSupportDate(request.sentAt)}`
      : formatSupportDate(request.createdAt);

  return (
    <article className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <span className={`absolute inset-y-0 left-0 w-0.5 ${accent}`} aria-hidden />
      <div className="px-3 py-2.5">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2 sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {request.student?.name ?? "Unknown student"}
              </h3>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {TYPE_LABELS[request.requestType]}
              </span>
              {request.createdBy && (
                <span
                  className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  title={`Created by ${request.createdBy.email}`}
                >
                  Admin created
                </span>
              )}
            </div>
            {email ? (
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{email}</p>
                <CopyEmailButton email={email} />
              </div>
            ) : (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Account unavailable
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
            <StatusPill status={request.status} />
            <span className="text-[11px] text-slate-500 dark:text-slate-400">{dateLabel}</span>
          </div>
        </div>

        {actionable && request.student && (
          variant === "openai" ? (
            <OpenAiConfirmForm
              requestId={request.id}
              csrfToken={csrfToken}
              requiresReauth={requiresReauth}
            />
          ) : (
            <N8nSendForm
              requestId={request.id}
              csrfToken={csrfToken}
              requiresReauth={requiresReauth}
            />
          )
        )}
      </div>
    </article>
  );
}

function emptyMessage(state: AccessRequestListState) {
  const name = state.tab === "openai" ? "OpenAI" : "n8n";
  if (state.q) {
    return `No ${state.showSent ? "" : "pending "}${name} requests match “${state.q}”.`;
  }
  return state.showSent ? `No ${name} requests yet.` : `No pending ${name} requests.`;
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
    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
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
  const [requests, openAiPending, n8nPending, csrfToken, isRecent] = await Promise.all([
    listN8nRequestQueue({
      requestTypes: TAB_TYPES[state.tab],
      statuses: accessQueueStatuses(state.showSent),
      search: state.q,
      page: state.page,
    }),
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

  const meta = TAB_META[state.tab];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Access requests"
        description="Copy the student email, then confirm OpenAI access or send the n8n link. API keys are never accepted, stored or emailed."
      />

      <AdminCreateAccessRequestForm csrfToken={csrfToken} requiresReauth={!isRecent} />

      <AccessRequestToolbar
        counts={{ openai: openAiPending, n8n: n8nPending }}
        state={state}
      />

      <section aria-label={meta.title} className="space-y-2">
        {requests.items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
            {emptyMessage(state)}
          </p>
        ) : (
          <div className="space-y-2">
            {requests.items.map((request) => (
              <RequestCard
                key={request.id}
                accent={meta.accent}
                csrfToken={csrfToken}
                request={request}
                requiresReauth={!isRecent}
                variant={meta.form}
              />
            ))}
          </div>
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
