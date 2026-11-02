import { redirect } from "next/navigation";

import { N8nSendForm } from "@/components/n8n/n8n-send-form";
import { AdminCreateAccessRequestForm } from "@/components/n8n/admin-create-access-request-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth-guard";
import { generateCsrfToken } from "@/lib/csrf";
import { formatSupportDate } from "@/lib/format-date";
import { isN8nAdmin } from "@/lib/n8n-request-policy";
import { listN8nRequests } from "@/lib/services/n8n-requests";

export const dynamic = "force-dynamic";
const labels = { ACCESS: "n8n access", PASSWORD_RESET: "n8n password reset", OPENAI_ACCESS: "OpenAI API access" } as const;

export default async function AccessRequestsPage() {
  const session = await requireRole("ADMIN");
  if (!(await isN8nAdmin(session.user.email))) redirect("/unauthorized");
  const [requests, csrfToken] = await Promise.all([listN8nRequests(), generateCsrfToken(session.user.id)]);

  return <div className="space-y-6">
    <PageHeader title="Access requests" description="Send approved n8n and OpenAI invitation links. API keys are never accepted or emailed." />
    <AdminCreateAccessRequestForm csrfToken={csrfToken} />
    {requests.length === 0 ? <p className="text-sm text-slate-500">No access request is waiting.</p> : <div className="grid gap-4 lg:grid-cols-2">
      {requests.map((request) => <article key={request.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="font-semibold">{request.student?.name ?? "Unknown student"}</h2><p className="text-sm text-slate-500">{request.student?.email ?? "Account unavailable"}</p></div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold dark:bg-slate-800">{request.status}</span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">Request</dt><dd className="font-medium">{labels[request.requestType]}</dd></div><div><dt className="text-slate-500">Requested</dt><dd>{formatSupportDate(request.createdAt)}</dd></div></dl>
        <p className="mt-3 text-xs text-slate-500">{request.createdBy ? `Created by admin · ${request.createdBy.email}` : "Requested by account owner"}</p>
        {request.purpose && <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What they want to build</p><p className="mt-1 whitespace-pre-wrap">{request.purpose}</p></div>}
        {(request.status === "PENDING" || request.status === "FAILED") && request.student && <N8nSendForm requestId={request.id} csrfToken={csrfToken} provider={request.requestType === "OPENAI_ACCESS" ? "OpenAI" : "n8n"} />}
        {request.status === "SENT" && <p className="mt-4 text-sm text-emerald-600">Email sent {request.sentAt ? formatSupportDate(request.sentAt) : "successfully"}.</p>}
        {request.status === "PROCESSING" && <p className="mt-4 text-sm text-amber-600">Processing. Do not send another link until this is reconciled.</p>}
      </article>)}
    </div>}
  </div>;
}
