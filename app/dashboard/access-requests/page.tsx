import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { AdminCreateAccessRequestForm } from "@/components/tool-access/admin-create-access-request-form";
import { CopyEmailButton } from "@/components/tool-access/copy-email-button";
import { N8nSendForm } from "@/components/tool-access/n8n-send-form";
import { OpenAiConfirmForm } from "@/components/tool-access/openai-confirm-form";
import { requireRole } from "@/lib/auth-guard";
import { generateCsrfToken } from "@/lib/csrf";
import { formatSupportDate } from "@/lib/format-date";
import { isN8nAdmin } from "@/lib/n8n-request-policy";
import { recentlySignedIn } from "@/lib/recent-auth";
import { listN8nRequestQueue } from "@/lib/services/n8n-requests";

export const dynamic = "force-dynamic";

type AccessRequest = Awaited<ReturnType<typeof listN8nRequestQueue>>["items"][number];
type Status = AccessRequest["status"];

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

const TYPE_LABELS = {
  ACCESS: "n8n access",
  PASSWORD_RESET: "n8n password reset",
  OPENAI_ACCESS: "OpenAI API access",
} as const;

/** Actionable requests first, then the rest, newest first inside each group. */
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
}: {
  request: AccessRequest;
  csrfToken: string;
  variant: "openai" | "n8n";
  requiresReauth: boolean;
}) {
  const email = request.student?.email ?? null;
  const actionable = request.status === "PENDING" || request.status === "FAILED";

  return (
    <article className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-xs transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <div>
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2 sm:items-center">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {request.student?.name ?? "Unknown student"}
            </h3>
            {email ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{email}</p>
                <CopyEmailButton email={email} />
              </div>
            ) : (
              <p className="mt-1 text-sm text-slate-500">Account unavailable</p>
            )}
          </div>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium dark:bg-slate-800">
            {TYPE_LABELS[request.requestType]}
          </span>
          <StatusPill status={request.status} />
          <span className="text-[11px] text-slate-500 sm:ml-auto">{formatSupportDate(request.createdAt)}</span>
        </div>

        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          {request.createdBy
            ? `Created by admin · ${request.createdBy.email}`
            : "Requested by account owner"}
        </p>

        {request.purpose && (
          <details className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs dark:bg-slate-800/40">
            <summary className="cursor-pointer font-medium text-slate-500">Request details</summary>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              What they want to build
            </p>
            <p className="mt-1 whitespace-pre-wrap">{request.purpose}</p>
          </details>
        )}

        {actionable && request.student && (
          variant === "openai" ? (
            <OpenAiConfirmForm requestId={request.id} csrfToken={csrfToken} requiresReauth={requiresReauth} />
          ) : (
            <N8nSendForm requestId={request.id} csrfToken={csrfToken} requiresReauth={requiresReauth} />
          )
        )}

        {request.status === "SENT" && (
          <p className="mt-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            <span aria-hidden>✓</span>
            Email sent {request.sentAt ? formatSupportDate(request.sentAt) : "successfully"}.
          </p>
        )}
        {request.status === "PROCESSING" && (
          <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-300">
            Processing with a recoverable 10-minute lease.
          </p>
        )}
      </div>
    </article>
  );
}

function SectionHeader({
  headingId,
  title,
  description,
  count,
  icon,
  tone,
}: {
  headingId: string;
  title: string;
  description: string;
  count: number;
  icon: ReactNode;
  tone: "openai" | "n8n";
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${
            tone === "openai"
              ? "bg-linear-to-br from-emerald-500 to-teal-600"
              : "bg-linear-to-br from-cyan-500 to-indigo-600"
          }`}
        >
          {icon}
        </span>
        <div>
          <h2 id={headingId} className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {count} {count === 1 ? "request" : "requests"}
      </span>
    </div>
  );
}

function EmptyRow({ children }: { children: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
      {children}
    </p>
  );
}

function QueuePagination({
  page,
  totalPages,
  pageKey,
  otherPage,
  otherPageKey,
}: {
  page: number;
  totalPages: number;
  pageKey: "openaiPage" | "n8nPage";
  otherPage: number;
  otherPageKey: "openaiPage" | "n8nPage";
}) {
  if (totalPages <= 1) return null;
  const href = (next: number) => {
    const params = new URLSearchParams();
    if (next > 1) params.set(pageKey, String(next));
    if (otherPage > 1) params.set(otherPageKey, String(otherPage));
    return `/dashboard/access-requests${params.size ? `?${params}` : ""}`;
  };
  return (
    <nav className="flex items-center justify-end gap-2 text-xs" aria-label="Request queue pages">
      {page > 1 && <Link className="rounded-lg border px-2.5 py-1.5" href={href(page - 1)}>Previous</Link>}
      <span className="text-slate-500">{page} / {totalPages}</span>
      {page < totalPages && <Link className="rounded-lg border px-2.5 py-1.5" href={href(page + 1)}>Next</Link>}
    </nav>
  );
}

export default async function AccessRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<{ openaiPage?: string; n8nPage?: string }>;
}) {
  const session = await requireRole("ADMIN");
  if (!(await isN8nAdmin(session.user.email))) redirect("/unauthorized");
  const params = await searchParams;
  const parsePage = (value?: string) => /^\d+$/.test(value ?? "") ? Math.max(1, Math.min(10_000, Number(value))) : 1;
  const openaiPage = parsePage(params?.openaiPage);
  const n8nPage = parsePage(params?.n8nPage);
  const [openAiRequests, n8nRequests, csrfToken, isRecent] = await Promise.all([
    listN8nRequestQueue(["OPENAI_ACCESS"], openaiPage),
    listN8nRequestQueue(["ACCESS", "PASSWORD_RESET"], n8nPage),
    generateCsrfToken(session.user.id),
    recentlySignedIn(session.user.id),
  ]);
  if (openAiRequests.total > 0 && openaiPage > openAiRequests.totalPages) redirect("/dashboard/access-requests");
  if (n8nRequests.total > 0 && n8nPage > n8nRequests.totalPages) redirect("/dashboard/access-requests");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Access requests"
        description="OpenAI emails its own invitation; n8n needs a link from you. API keys are never accepted, stored or emailed."
      />

      <AdminCreateAccessRequestForm csrfToken={csrfToken} requiresReauth={!isRecent} />

      <section aria-labelledby="openai-requests-heading" className="space-y-4">
        <SectionHeader
          headingId="openai-requests-heading"
          title="OpenAI API access"
          description="Copy the email, add it in the OpenAI dashboard, then confirm. OpenAI sends the invite; we send the confirmation."
          count={openAiRequests.total}
          tone="openai"
          icon={
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" />
            </svg>
          }
        />
        {openAiRequests.items.length === 0 ? (
          <EmptyRow>No OpenAI access request is waiting.</EmptyRow>
        ) : (
          <div className="space-y-2">
            {openAiRequests.items.map((request) => (
              <RequestCard key={request.id} request={request} csrfToken={csrfToken} variant="openai" requiresReauth={!isRecent} />
            ))}
          </div>
        )}
        <QueuePagination page={openAiRequests.page} totalPages={openAiRequests.totalPages} pageKey="openaiPage" otherPage={n8nRequests.page} otherPageKey="n8nPage" />
      </section>

      <section aria-labelledby="n8n-requests-heading" className="space-y-4">
        <SectionHeader
          headingId="n8n-requests-heading"
          title="n8n access & password reset"
          description="Paste the link generated in n8n and email it. Links are sent immediately and never stored."
          count={n8nRequests.total}
          tone="n8n"
          icon={
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5 21 3M21 3h-5.25M21 3v5.25M10.5 13.5 3 21M3 21h5.25M3 21v-5.25" />
            </svg>
          }
        />
        {n8nRequests.items.length === 0 ? (
          <EmptyRow>No n8n access or password-reset request is waiting.</EmptyRow>
        ) : (
          <div className="space-y-2">
            {n8nRequests.items.map((request) => (
              <RequestCard key={request.id} request={request} csrfToken={csrfToken} variant="n8n" requiresReauth={!isRecent} />
            ))}
          </div>
        )}
        <QueuePagination page={n8nRequests.page} totalPages={n8nRequests.totalPages} pageKey="n8nPage" otherPage={openAiRequests.page} otherPageKey="openaiPage" />
      </section>
    </div>
  );
}
