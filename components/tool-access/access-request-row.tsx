"use client";

import { useCallback, useRef, useState } from "react";

import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { CopyEmailButton } from "@/components/tool-access/copy-email-button";
import { N8nSendForm } from "@/components/tool-access/n8n-send-form";
import { OpenAiConfirmForm } from "@/components/tool-access/openai-confirm-form";
import { RejectAccessRequestForm } from "@/components/tool-access/reject-access-request-form";
import { RetryRejectionEmailForm } from "@/components/tool-access/retry-rejection-email-form";
import { accessTableColumnsClass, chipClass, rowHoverClass } from "@/lib/ui";

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

/** Visible label on stacked rows; the desktop header row labels the columns. */
const cellLabelClass =
  "mb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 lg:sr-only dark:text-slate-500";

/**
 * One request as a table row. Actionable requests expose their final control
 * directly, without an intermediate Process/Close interaction.
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
  const showControls = (canProcess || canReject) && !rejectMode;
  const hasAction = showControls || request.rejectionNotificationFailed;

  return (
    <li
      className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 px-3 py-3 lg:items-center ${accessTableColumnsClass} ${rowHoverClass}`}
    >
      {/* Student */}
      <div className="col-start-1 row-start-1 flex min-w-0 items-start gap-2.5">
        <ProfileAvatar imageUrl={request.studentImage} name={request.studentName} />
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <h3 className="min-w-0 break-words text-sm font-semibold text-slate-900 dark:text-white">
              {request.studentName ?? "Unknown student"}
            </h3>
            {/* The OpenAI tab holds one request type; only n8n mixes two. */}
            {request.variant === "n8n" && <span className={chipClass}>{request.typeLabel}</span>}
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
      </div>

      {/* Status */}
      <div className="col-start-2 row-start-1 flex flex-col items-end gap-1 lg:col-start-4 lg:items-start">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${STATUS_TONES[request.statusTone]}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${STATUS_DOTS[request.statusTone]}`}
            aria-hidden
          />
          {request.statusLabel}
        </span>
        <span className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
          {request.dateLabel}
        </span>
      </div>

      {/* Facts: their own two-column grid when stacked, plain cells on xl. */}
      <div className="col-span-2 row-start-2 grid grid-cols-2 gap-x-4 sm:pl-[46px] lg:contents">
        <div className="min-w-0 text-xs leading-5 lg:col-start-2 lg:row-start-1">
          <p className={cellLabelClass}>Enrollment</p>
          {request.batchLabel ? (
            <p className="font-medium text-slate-700 dark:text-slate-200">{request.batchLabel}</p>
          ) : (
            <p className="font-medium text-amber-700 dark:text-amber-400">
              Not enrolled in the AI Agent course
            </p>
          )}
          <p className="text-slate-500 dark:text-slate-400">{request.enrollmentLabel}</p>
        </div>

        <div className="min-w-0 text-xs leading-5 lg:col-start-3 lg:row-start-1">
          <p className={cellLabelClass}>Access</p>
          <p className="font-medium text-slate-700 dark:text-slate-200">
            {request.entitlementLabel}
          </p>
          <p className="text-slate-500 dark:text-slate-400">{request.historyLabel}</p>
          <p className="text-slate-400 dark:text-slate-500">{request.firstRequestedLabel}</p>
        </div>
      </div>

      {/* Action */}
      {hasAction && (
        <div className="col-span-2 row-start-3 flex min-w-0 flex-col gap-1.5 sm:pl-[46px] lg:col-span-1 lg:col-start-5 lg:row-start-1 lg:items-end lg:pl-0">
          {showControls && (
            <div className="flex w-full min-w-0 flex-nowrap items-start gap-1.5 max-[420px]:flex-wrap lg:justify-end">
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
      )}

      {rejectMode && (
        <section
          aria-label="Reject access request"
          className="col-span-2 min-w-0 sm:pl-[46px] lg:col-span-5 lg:pl-0"
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
    </li>
  );
}
