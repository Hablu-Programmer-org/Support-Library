"use client";

import { useState } from "react";

import { N8nRequestForm } from "@/components/n8n/n8n-request-form";
import { OpenAiRequestForm } from "@/components/n8n/openai-request-form";
import { cn } from "@/lib/cn";

type RequestSummary = {
  id: string;
  requestType: "ACCESS" | "PASSWORD_RESET" | "OPENAI_ACCESS";
  status: "PENDING" | "PROCESSING" | "SENT" | "FAILED";
  sentAt?: string | null;
};

const isActive = (status: RequestSummary["status"]) => status === "PENDING" || status === "PROCESSING";

function RequestState({ request }: { request: RequestSummary }) {
  const sent = request.status === "SENT";
  return <div className={cn(
    "rounded-xl border p-4 text-sm",
    sent
      ? "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100"
      : "border-cyan-200 bg-cyan-50 text-slate-800 dark:border-cyan-900 dark:bg-cyan-950/20 dark:text-slate-100",
  )}>
    <p className="font-semibold">{sent ? "Your email has been sent" : "Your request is with the support team"}</p>
    <p className="mt-1 text-slate-600 dark:text-slate-300">
      {sent
        ? "Check your registered Gmail inbox, Spam and Promotions. Use the invitation soon because it may expire."
        : request.status === "PROCESSING" ? "Your secure email is being prepared. Please do not submit again." : "We will update this card after the email is sent."}
    </p>
  </div>;
}

export function AccessHelpCard({ csrfToken, requests }: { csrfToken: string; requests: RequestSummary[] }) {
  const [tab, setTab] = useState<"n8n" | "openai">("n8n");
  const n8nRequests = requests.filter((request) => request.requestType !== "OPENAI_ACCESS");
  const openAiRequests = requests.filter((request) => request.requestType === "OPENAI_ACCESS");
  const current = (tab === "n8n" ? n8nRequests : openAiRequests).find((request) => isActive(request.status))
    ?? (tab === "n8n" ? n8nRequests : openAiRequests).find((request) => request.status === "SENT");
  const hasActive = Boolean(current && isActive(current.status));

  return <section aria-labelledby="access-help-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div className="mb-4">
      <h2 id="access-help-heading" className="text-lg font-semibold">Help &amp; access</h2>
      <p className="mt-1 text-sm text-slate-500">Request account access without sharing passwords or API keys.</p>
    </div>
    <div className="mb-5 flex border-b border-slate-200 dark:border-slate-800" role="tablist" aria-label="Access request type">
      {(["n8n", "openai"] as const).map((item) => {
        const activeForTab = (item === "n8n" ? n8nRequests : openAiRequests).some((request) => isActive(request.status));
        return <button
          key={item}
          type="button"
          role="tab"
          aria-selected={tab === item}
          onClick={() => setTab(item)}
          className={cn("border-b-2 px-4 py-2 text-sm font-semibold transition", tab === item ? "border-cyan-500 text-cyan-600" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200")}
        >
          {item === "n8n" ? "n8n help" : "OpenAI API access"}{activeForTab && <span className="ml-2 text-cyan-500" aria-label="active request">●</span>}
        </button>;
      })}
    </div>
    {current && <div className="mb-5"><RequestState request={current} /></div>}
    {!hasActive && (tab === "n8n" ? <N8nRequestForm csrfToken={csrfToken} /> : <OpenAiRequestForm csrfToken={csrfToken} />)}
  </section>;
}
