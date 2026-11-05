"use client";

import { useCallback, useRef, useState } from "react";

import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { CopyEmailButton } from "@/components/tool-access/copy-email-button";
import { N8nSendForm } from "@/components/tool-access/n8n-send-form";
import { OpenAiConfirmForm } from "@/components/tool-access/openai-confirm-form";
import { RejectAccessRequestForm } from "@/components/tool-access/reject-access-request-form";
import { RetryRejectionEmailForm } from "@/components/tool-access/retry-rejection-email-form";
import { chipClass, rowHoverClass } from "@/lib/ui";

export type AccessRowRequest = {
  id: string;
  /** Pre-formatted on the server so SSR and the browser cannot disagree. */
  typeLabel: string;
  statusLabel: string;
  statusTone: "waiting" | "processing" | "sent" | "failed" | "muted";
  dateLabel: string;
  studentName: string | null;
  studentImage: string | null;
  email: string | null;
  /** `Batch 4`, or `null` when the enrolment has no usable batch. */
  batchLabel: string | null;
  /** e.g. `n8n access sent 2× · Last 1 Nov` or `First n8n access request`. */
  historyLabel: string;
  firstRequestedLabel: string;
  entitlementLabel: string;
  enrollmentLabel: string;
  createdByEmail: string | null;
  variant: "openai" | "n8n";
  canApprove: boolean;
  canReject: boolean;
  rejectionNotificationFailed: boolean;
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
  const [decisionSaved, setDecisionSaved] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const rejectButtonRef = useRef<HTMLButtonElement>(null);
  const onDecisionSaved = useCallback(() => setDecisionSaved(true), []);
  const canProcess = request.canApprove && !decisionSaved;
  const canReject = request.canReject && !decisionSaved;

  const closeReject = useCallback(() => {
    setRejectOpen(false);
    window.setTimeout(() => rejectButtonRef.current?.focus(), 0);
  }, []);

  const rejectMode = canReject && rejectOpen;

  return (
    <li className={`px-1 py-2.5 sm:px-2 ${rowHoverClass}`}>
      <div className="grid min-w-0 grid-cols-[36px_minmax(0,1fr)] items-start gap-x-2.5">
        <ProfileAvatar imageUrl={request.studentImage} name={request.studentName} />

        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <h3 className="min-w-0 break-words text-sm font-semibold text-slate-900 dark:text-white">
                  {request.studentName ?? "Unknown student"}
                </h3>
                <span className={chipClass}>{request.typeLabel}</span>
                {request.createdByEmail && (
                  <span
                    className={`${chipClass} text-slate-500 dark:text-slate-400`}
                    title={`Created by ${request.createdByEmail}`}
                  >
                    Admin created
                  </span>
                )}
              </div>
              <div className="mt-0.5 min-w-0">
                {request.email ? (
                  <CopyEmailButton email={request.email} />
                ) : (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Account unavailable
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${STATUS_TONES[request.statusTone]}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${STATUS_DOTS[request.statusTone]}`}
                  aria-hidden
                />
                {request.statusLabel}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {request.dateLabel}
              </span>
            </div>
          </div>

          <div className="mt-1.5 flex min-w-0 flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
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
              <span>{request.enrollmentLabel}</span>
              <span aria-hidden>·</span>
              <span>{request.firstRequestedLabel}</span>
              <span aria-hidden>·</span>
              <span>{request.historyLabel}</span>
              <span aria-hidden>·</span>
              <span className="font-medium text-slate-600 dark:text-slate-300">
                {request.entitlementLabel}
              </span>
            </div>

            {(canProcess || canReject) && !rejectMode && (
              <div
                className={`flex min-w-0 flex-wrap items-start justify-end gap-1.5 ${request.variant === "n8n" ? "lg:w-auto lg:max-w-[560px] lg:flex-nowrap" : ""}`}
              >
                {canProcess &&
                  (request.variant === "openai" ? (
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
                  ))}
                {canReject && (
                  <button
                    ref={rejectButtonRef}
                    aria-controls={`reject-panel-${request.id}`}
                    aria-expanded={false}
                    className="inline-flex shrink-0 items-center justify-center rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-400 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30 max-[420px]:w-full dark:border-rose-900 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
                    onClick={() => setRejectOpen(true)}
                    type="button"
                  >
                    Reject
                  </button>
                )}
              </div>
            )}
            {request.rejectionNotificationFailed && (
              <RetryRejectionEmailForm
                requestId={request.id}
                csrfToken={csrfToken}
                requiresReauth={requiresReauth}
              />
            )}
          </div>

          {rejectMode && (
            <section
              aria-label="Reject access request"
              className="mt-1.5 w-full min-w-0"
              id={`reject-panel-${request.id}`}
            >
              <RejectAccessRequestForm
                requestId={request.id}
                csrfToken={csrfToken}
                onDecisionSaved={onDecisionSaved}
                onCancel={closeReject}
              />
            </section>
          )}
        </div>
      </div>
    </li>
  );
}
