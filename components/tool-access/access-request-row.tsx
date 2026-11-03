"use client";

import { CopyEmailButton } from "@/components/tool-access/copy-email-button";
import { N8nSendForm } from "@/components/tool-access/n8n-send-form";
import { OpenAiConfirmForm } from "@/components/tool-access/openai-confirm-form";

export type AccessRowRequest = {
  id: string;
  /** Pre-formatted on the server so SSR and the browser cannot disagree. */
  typeLabel: string;
  statusLabel: string;
  statusTone: "waiting" | "processing" | "sent" | "failed" | "muted";
  dateLabel: string;
  studentName: string | null;
  email: string | null;
  /** `Batch 4`, or `null` when the enrolment has no usable batch. */
  batchLabel: string | null;
  /** e.g. `n8n access sent 2× · Last 1 Nov` or `First n8n access request`. */
  historyLabel: string;
  createdByEmail: string | null;
  variant: "openai" | "n8n";
  actionable: boolean;
  agentEligible: boolean;
};

const STATUS_TONES: Record<AccessRowRequest["statusTone"], string> = {
  waiting:
    "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
  processing:
    "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900",
  sent:
    "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
  failed:
    "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900",
  muted:
    "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
};

const STATUS_DOTS: Record<AccessRowRequest["statusTone"], string> = {
  waiting: "bg-amber-500",
  processing: "bg-sky-500",
  sent: "bg-emerald-500",
  failed: "bg-red-500",
  muted: "bg-slate-400",
};

/**
 * One request as a compact, scannable row. Actionable requests expose their
 * final control directly, without an intermediate Process/Close interaction.
 */
export function AccessRequestRow({
  request,
  csrfToken,
  requiresReauth,
}: {
  request: AccessRowRequest;
  csrfToken: string;
  requiresReauth: boolean;
}) {
  const canProcess = request.actionable && request.agentEligible;

  return (
    <li className="px-3 py-3 sm:px-4">
      <div className="space-y-2">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1 sm:flex-nowrap">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {request.studentName ?? "Unknown student"}
            </h3>
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {request.typeLabel}
            </span>
            {request.createdByEmail && (
              <span
                className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                title={`Created by ${request.createdByEmail}`}
              >
                Admin created
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${STATUS_TONES[request.statusTone]}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${STATUS_DOTS[request.statusTone]}`}
                aria-hidden
              />
              {request.statusLabel}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {request.dateLabel}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            {request.email ? (
              <>
                <span className="max-w-full truncate text-xs text-slate-600 dark:text-slate-300">
                  {request.email}
                </span>
                <CopyEmailButton email={request.email} className="px-2 py-1 text-[11px]" />
              </>
            ) : (
              <span className="text-xs">Account unavailable</span>
            )}
            <span aria-hidden>·</span>
            {request.batchLabel ? (
              <span className="font-medium text-slate-600 dark:text-slate-300">
                {request.batchLabel}
              </span>
            ) : (
              <span className="font-medium text-amber-700 dark:text-amber-400">
                Not enrolled in the AI Agent course
              </span>
            )}
            <span aria-hidden>·</span>
            <span>{request.historyLabel}</span>
          </div>

          {canProcess && (
            <div className={`min-w-0 shrink-0 ${request.variant === "n8n" ? "lg:w-[42%]" : ""}`}>
              {request.variant === "openai" ? (
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
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
