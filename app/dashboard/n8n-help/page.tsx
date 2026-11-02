import { N8nRequestForm } from "@/components/n8n/n8n-request-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth-guard";
import { generateCsrfToken } from "@/lib/csrf";
import { formatSupportDate } from "@/lib/format-date";
import { listOwnN8nRequests } from "@/lib/services/n8n-requests";

export const dynamic = "force-dynamic";

const labels = { ACCESS: "n8n access", PASSWORD_RESET: "Password reset" } as const;

export default async function N8nHelpPage() {
  const session = await requireRole("STUDENT");
  if (session.user.role !== "STUDENT") return null;
  const [requests, csrfToken] = await Promise.all([
    listOwnN8nRequests(session.user.id),
    generateCsrfToken(session.user.id),
  ]);
  const latestSent = requests.find((request) => request.status === "SENT");

  return <div className="space-y-6">
    <PageHeader title="n8n help" description="Request n8n access or a password reset link." />
    {latestSent && <section className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
      <h2 className="font-semibold">Your email has been sent</h2>
      <p className="mt-2 text-sm">Check your registered Gmail inbox and open the button in the Hablu Support Library email. If you cannot find it, check Spam and Promotions. Use the link soon because n8n links can expire.</p>
      <p className="mt-2 text-xs">Sent {latestSent.sentAt ? formatSupportDate(latestSent.sentAt) : "recently"}</p>
    </section>}
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-1 text-lg font-semibold">What do you need?</h2>
      <p className="mb-5 text-sm text-slate-500">Choose one option. The support team will send the secure link to your registered email.</p>
      <N8nRequestForm csrfToken={csrfToken} />
    </section>
    <section className="space-y-3">
      <h2 className="font-semibold">Your recent requests</h2>
      {requests.length === 0 ? <p className="text-sm text-slate-500">No n8n request yet.</p> : requests.map((request) => <div key={request._id.toString()} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 py-3 dark:border-slate-800">
        <div><p className="font-medium">{labels[request.requestType]}</p><p className="text-xs text-slate-500">{formatSupportDate(request.createdAt)}</p></div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold dark:bg-slate-800">{request.status}</span>
      </div>)}
    </section>
  </div>;
}
