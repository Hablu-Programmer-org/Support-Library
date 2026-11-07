"use client";

import { useActionState } from "react";

import { createN8nRequestAction } from "@/actions/n8n-requests";
import { PendingSubmitButton } from "@/components/issues/pending-submit-button";
import { cn } from "@/lib/cn";
import { formatSupportDateOnly, formatSupportShortDate } from "@/lib/format-date";

type RequestType = "ACCESS" | "PASSWORD_RESET" | "OPENAI_ACCESS";
type RequestStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "REJECTED" | "SUPERSEDED";

type RequestSummary = {
  id: string;
  requestType: RequestType;
  status: RequestStatus;
  sentAt?: string | null;
};

/**
 * What the student already holds. Optional: the card still works without it,
 * and the server remains the single authority on every decision — this only
 * stops the UI offering a request the policy will always refuse.
 */
export type ToolEntitlementSummary = {
  state: "ACTIVE" | "EXPIRED" | "REVOKED";
  expiresAt: string;
  revokedAt?: string | null;
};

export type AccessHelpEntitlements = {
  n8n?: ToolEntitlementSummary | null;
  openai?: ToolEntitlementSummary | null;
};

const choices = [
  { value: "ACCESS", label: "n8n access" },
  { value: "PASSWORD_RESET", label: "n8n password reset" },
  { value: "OPENAI_ACCESS", label: "OpenAI API access" },
] as const;

const active = (status: RequestStatus) => status === "PENDING" || status === "PROCESSING";

const TOOL_FOR_TYPE: Record<RequestType, "n8n" | "openai"> = {
  ACCESS: "n8n",
  PASSWORD_RESET: "n8n",
  OPENAI_ACCESS: "openai",
};
const TOOL_NAMES = { n8n: "n8n", openai: "OpenAI" } as const;

/**
 * Why a choice cannot be requested, or `null` when it still can.
 *
 * Mirrors `requestEntitlementAllowsProcessing`: new access needs no entitlement
 * yet, while a password reset needs an active one.
 */
function entitlementNotice(
  requestType: RequestType,
  entitlements: AccessHelpEntitlements,
): { chip: string; title: string } | null {
  const tool = TOOL_FOR_TYPE[requestType];
  const entitlement = entitlements[tool];
  const toolName = TOOL_NAMES[tool];

  if (requestType === "PASSWORD_RESET") {
    if (entitlement?.state === "ACTIVE") return null;
    return {
      chip: "Needs n8n access",
      title: "A password reset needs active n8n access. Request n8n access first.",
    };
  }

  if (!entitlement) return null;

  const revokedOn = formatSupportDateOnly(entitlement.revokedAt);
  const expiresOn = formatSupportDateOnly(entitlement.expiresAt);

  if (entitlement.state === "ACTIVE") {
    return {
      chip: expiresOn ? `Until ${expiresOn}` : "Active",
      title: `Your ${toolName} access is active${expiresOn ? ` until ${expiresOn}` : ""}.`,
    };
  }
  if (entitlement.state === "EXPIRED") {
    return {
      chip: expiresOn ? `Expired ${expiresOn}` : "Expired",
      title: `Your ${toolName} access expired${expiresOn ? ` on ${expiresOn}` : ""}. Renewal is not available in this form yet.`,
    };
  }
  return {
    chip: revokedOn ? `Revoked ${revokedOn}` : "Revoked",
    title: `Your ${toolName} access was revoked${revokedOn ? ` on ${revokedOn}` : ""}. A new request is blocked by policy.`,
  };
}

const STATUS_TEXT: Record<RequestStatus, string> = {
  PENDING: "Request received",
  PROCESSING: "Processing",
  SENT: "Sent",
  FAILED: "Try again",
  REJECTED: "Not approved",
  SUPERSEDED: "Replaced",
};

/** Fixed order so a summary never depends on the order of the API response. */
const SENT_ORDER: RequestType[] = ["ACCESS", "PASSWORD_RESET", "OPENAI_ACCESS"];
const SENT_SUBJECTS: Record<RequestType, string> = {
  ACCESS: "n8n invite",
  PASSWORD_RESET: "Reset link",
  OPENAI_ACCESS: "OpenAI invite",
};
const REQUEST_SUBJECTS: Record<RequestType, string> = {
  ACCESS: "n8n access",
  PASSWORD_RESET: "password reset",
  OPENAI_ACCESS: "OpenAI API",
};

function joinSubjects(subjects: string[]) {
  if (subjects.length <= 1) return subjects[0] ?? "";
  if (subjects.length === 2) return `${subjects[0]} & ${subjects[1]}`;
  return `${subjects[0]}, ${subjects[1]} & ${subjects[2]}`;
}

/**
 * Builds one short sentence for every combination of sent requests so the
 * message row never needs to grow or wrap on desktop.
 */
export function sentRequestsMessage(requests: RequestSummary[]) {
  const sent = new Set(
    requests.filter((request) => request.status === "SENT").map((request) => request.requestType),
  );
  const subjects = SENT_ORDER.filter((type) => sent.has(type)).map((type) => SENT_SUBJECTS[type]);
  if (subjects.length === 0) return null;
  if (sent.size === 2 && sent.has("ACCESS") && sent.has("OPENAI_ACCESS")) {
    return "n8n & OpenAI invites sent — check Inbox/Spam.";
  }
  if (subjects.length === 1) return `${subjects[0]} sent — check Inbox/Spam.`;
  if (subjects.length === 2) return `${subjects[0]} & ${subjects[1]} sent — check Inbox/Spam.`;
  return `${subjects[0]}, ${subjects[1]} & ${subjects[2]} sent — check Inbox/Spam.`;
}

/** Newest request per type; the API returns newest first, so the first hit wins. */
export function newestByType(requests: RequestSummary[]) {
  const latest = new Map<RequestType, RequestSummary>();
  for (const request of requests) {
    if (!latest.has(request.requestType)) latest.set(request.requestType, request);
  }
  return latest;
}

/**
 * Names what was submitted and what happens next, e.g.
 * "n8n access & OpenAI API requests submitted — awaiting admin approval."
 * Sent and pending work can coexist, so each state becomes one clause.
 */
export function requestStatusMessage(requests: RequestSummary[]) {
  const latest = newestByType(requests);
  const subjectsFor = (status: RequestStatus) =>
    SENT_ORDER.filter((type) => latest.get(type)?.status === status).map((type) => REQUEST_SUBJECTS[type]);

  const clauses: string[] = [];

  const failed = subjectsFor("FAILED");
  if (failed.length > 0) {
    clauses.push(`${joinSubjects(failed)} could not be completed — please try again.`);
  }

  const pending = subjectsFor("PENDING");
  if (pending.length > 0) {
    clauses.push(
      `${joinSubjects(pending)} request${pending.length === 1 ? "" : "s"} submitted — awaiting admin approval.`,
    );
  }

  const processing = subjectsFor("PROCESSING");
  if (processing.length > 0) {
    clauses.push(`${joinSubjects(processing)} ${processing.length === 1 ? "is" : "are"} being processed.`);
  }

  const sent = sentRequestsMessage(
    SENT_ORDER.flatMap((type) => {
      const request = latest.get(type);
      return request ? [request] : [];
    }),
  );
  if (sent) clauses.push(sent);

  return clauses.length > 0 ? clauses.join(" · ") : null;
}

function StatusChip({ status, sentAt }: { status: RequestStatus; sentAt?: string | null }) {
  // Fixed locale + Dhaka time zone: a runtime locale here renders "Nov 3" on the
  // server and "3 Nov" in the browser, which fails hydration.
  const date = formatSupportShortDate(sentAt);
  const label = status === "SENT" && date ? `${STATUS_TEXT.SENT} · ${date}` : STATUS_TEXT[status];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
        status === "SENT" &&
          "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
        status === "FAILED" &&
          "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900",
        status === "SUPERSEDED" &&
          "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
        (status === "PENDING" || status === "PROCESSING") &&
          "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-1 w-1 rounded-full",
          status === "SENT" && "bg-emerald-500",
          (status === "FAILED" || status === "REJECTED") && "bg-red-500",
          status === "SUPERSEDED" && "bg-slate-400",
          (status === "PENDING" || status === "PROCESSING") && "animate-pulse bg-amber-500",
        )}
      />
      {label}
    </span>
  );
}

export function AccessHelpCard({
  csrfToken,
  requests,
  entitlements,
}: {
  csrfToken: string;
  requests: RequestSummary[];
  entitlements?: AccessHelpEntitlements;
}) {
  const [state, action] = useActionState(createN8nRequestAction, {});
  const statusMessage = requestStatusMessage(requests);
  // Tone follows the same newest-per-type view as the sentence, so a replaced
  // failure cannot turn a pending message red.
  const latestStatuses = [...newestByType(requests).values()].map((request) => request.status);
  const statusTone = latestStatuses.includes("REJECTED") || latestStatuses.includes("FAILED")
    ? ("error" as const)
    : latestStatuses.includes("SENT")
      ? ("success" as const)
      : ("muted" as const);
  const message = state.error
    ? { text: state.error, tone: "error" as const }
    : state.warning
      ? {
          text: `${state.success ? `${state.success} ` : ""}${state.warning}`,
          tone: "warning" as const,
        }
      : statusMessage
        ? { text: statusMessage, tone: statusTone }
        : state.success
          ? { text: state.success, tone: "success" as const }
          : { text: "Select the access you need.", tone: "muted" as const };

  return (
    <section
      aria-labelledby="access-help-heading"
      className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-cyan-400/0 via-cyan-400/70 to-indigo-400/0"
      />
      <div className="p-3 sm:p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-cyan-500 to-indigo-600 text-white shadow-sm">
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75 14.1 8l4.65.65-3.4 3.3.8 4.6L12 14.4l-4.15 2.15.8-4.6-3.4-3.3L9.9 8 12 3.75Z" />
            </svg>
          </span>
          <h2 id="access-help-heading" className="text-sm font-semibold text-slate-900 dark:text-white">
            Help &amp; access
          </h2>
          <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 sm:inline dark:bg-slate-800 dark:text-slate-400">
            n8n · OpenAI
          </span>
        </div>

        <form action={action} className="space-y-2">
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
            <fieldset className="grid gap-2 lg:min-w-0 lg:flex-1 lg:grid-cols-3" aria-label="Choose access requests">
              <legend className="sr-only">Choose access requests</legend>
              {choices.map((choice) => {
                const latest = requests.find((request) => request.requestType === choice.value);
                const isActive = Boolean(latest && active(latest.status));
                const notice = entitlements ? entitlementNotice(choice.value, entitlements) : null;
                const disabled = isActive || Boolean(notice);
                const hintId = `access-hint-${choice.value}`;
                return (
                  <label
                    key={choice.value}
                    title={notice?.title}
                    className="group flex h-11 min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 text-xs transition hover:border-cyan-300 hover:bg-cyan-50/40 has-checked:border-cyan-500 has-checked:bg-cyan-50 has-checked:ring-1 has-checked:ring-cyan-500/30 has-disabled:cursor-not-allowed has-disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-cyan-700 dark:hover:bg-cyan-950/20 dark:has-checked:bg-cyan-950/40"
                  >
                    <input
                      aria-describedby={notice ? hintId : undefined}
                      aria-label={choice.label}
                      className="h-3.5 w-3.5 shrink-0 accent-cyan-600"
                      type="checkbox"
                      name="requestTypes"
                      value={choice.value}
                      disabled={disabled}
                    />
                    <span className="truncate font-medium text-slate-700 dark:text-slate-200">{choice.label}</span>
                    {notice ? (
                      <span
                        className="ml-auto shrink-0 truncate text-[10px] font-medium text-slate-500 dark:text-slate-400"
                        id={hintId}
                      >
                        {notice.chip}
                      </span>
                    ) : latest ? (
                      <span className="ml-auto">
                        <StatusChip status={latest.status} sentAt={latest.sentAt} />
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </fieldset>
            <PendingSubmitButton
              label="Submit request"
              pendingLabel="Submitting…"
              className="w-full shrink-0 lg:h-auto lg:w-auto lg:self-stretch lg:px-4"
            />
          </div>

          <div className="flex flex-col gap-1 border-t border-slate-200 pt-2 text-[11px] leading-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 dark:border-slate-800">
            <p
              role={message.tone === "muted" ? undefined : message.tone === "error" ? "alert" : "status"}
              title={message.text}
              className={cn(
                "min-w-0 sm:truncate",
                message.tone === "error" && "text-red-600",
                message.tone === "success" && "text-emerald-600",
                message.tone === "warning" && "text-amber-600",
                message.tone === "muted" && "text-slate-500 dark:text-slate-400",
              )}
            >
              {message.text}
            </p>
            <p className="shrink-0 whitespace-nowrap text-slate-500 dark:text-slate-400">
              n8n: 1 year · OpenAI: 2 months
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
