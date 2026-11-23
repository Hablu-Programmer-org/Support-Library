"use client";

import { useActionState, useState } from "react";

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

type SummaryTone = "success" | "pending" | "error" | "muted";

/**
 * One status per tool for the collapsed strip, e.g. "Until 7 Nov 2027".
 *
 * Display only: an active entitlement wins, then the newest in-flight or
 * finished request (a replaced one is ignored), then an expired/revoked
 * entitlement. n8n reads the access request; a password reset is not a
 * separate tool state.
 */
export function toolSummary(
  tool: "n8n" | "openai",
  latest: Map<RequestType, RequestSummary>,
  entitlements?: AccessHelpEntitlements,
): { label: string; tone: SummaryTone } {
  const entitlement = entitlements?.[tool] ?? null;
  const request = latest.get(tool === "n8n" ? "ACCESS" : "OPENAI_ACCESS");

  if (entitlement?.state === "ACTIVE") {
    const until = formatSupportDateOnly(entitlement.expiresAt);
    return { label: until ? `Until ${until}` : "Active", tone: "success" };
  }
  if (request && request.status !== "SUPERSEDED") {
    if (request.status === "SENT") {
      const date = formatSupportShortDate(request.sentAt);
      return { label: date ? `Sent ${date}` : "Sent", tone: "success" };
    }
    if (request.status === "PENDING" || request.status === "PROCESSING") {
      return { label: STATUS_TEXT[request.status], tone: "pending" };
    }
    return { label: STATUS_TEXT[request.status], tone: "error" };
  }
  if (entitlement?.state === "EXPIRED") {
    const on = formatSupportDateOnly(entitlement.expiresAt);
    return { label: on ? `Expired ${on}` : "Expired", tone: "muted" };
  }
  if (entitlement?.state === "REVOKED") {
    const on = formatSupportDateOnly(entitlement.revokedAt);
    return { label: on ? `Revoked ${on}` : "Revoked", tone: "muted" };
  }
  return { label: "Not requested", tone: "muted" };
}

/**
 * Open on first load when there is something to do: nothing requested and no
 * access yet, or the newest request for a type failed or was not approved.
 */
export function accessCardStartsOpen(
  requests: RequestSummary[],
  entitlements?: AccessHelpEntitlements,
): boolean {
  const latest = [...newestByType(requests).values()];
  if (latest.some((request) => request.status === "FAILED" || request.status === "REJECTED")) return true;
  const hasEntitlement = Boolean(entitlements?.n8n || entitlements?.openai);
  return latest.length === 0 && !hasEntitlement;
}

const TONE_DOT: Record<SummaryTone, string> = {
  success: "bg-emerald-500",
  pending: "animate-pulse bg-amber-500",
  error: "bg-red-500",
  muted: "bg-slate-400 dark:bg-slate-500",
};

const TILE_DETAIL: Record<RequestType, string> = {
  ACCESS: "Valid for 1 year",
  PASSWORD_RESET: "For active n8n access",
  OPENAI_ACCESS: "Valid for 2 months",
};

function KeyIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4.5 w-4.5">
      <circle cx="8" cy="15" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m10.85 12.15 7.65-7.65M15.5 7.5l2.5 2.5M18 5l2 2" />
    </svg>
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
  const [open, setOpen] = useState(() => accessCardStartsOpen(requests, entitlements));
  // A failed or partial submit must be seen: open the card when a new action
  // result carries an error or warning (adjusting state during render, not in
  // an effect, so there is no closed flash).
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.error || state.warning) setOpen(true);
  }

  const latestByType = newestByType(requests);
  const statusMessage = requestStatusMessage(requests);
  // Tone follows the same newest-per-type view as the sentence, so a replaced
  // failure cannot turn a pending message red.
  const latestStatuses = [...latestByType.values()].map((request) => request.status);
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

  const summaries = (["n8n", "openai"] as const).map((tool) => ({
    tool,
    ...toolSummary(tool, latestByType, entitlements),
  }));

  return (
    <section
      aria-labelledby="access-help-heading"
      className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
    >
      {/* The whole header row toggles: the Manage button's `after:inset-0`
          stretches its hit area over the row (same pattern as IssueCard), so
          it stays one real button for keyboard and screen readers. */}
      <div
        className={cn(
          "relative flex flex-wrap items-center gap-x-4 gap-y-2 rounded-t-2xl px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40",
          !open && "rounded-b-2xl",
        )}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600 ring-1 ring-inset ring-cyan-500/25 dark:text-cyan-300">
            <KeyIcon />
          </span>
          <h2 id="access-help-heading" className="text-sm font-semibold text-slate-900 dark:text-white">
            Tool access
          </h2>
        </div>

        <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1" aria-label="Access status">
          {summaries.map((summary) => (
            <li
              key={summary.tool}
              className="flex min-w-0 items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"
              data-testid={`access-summary-${summary.tool}`}
            >
              <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[summary.tone])} />
              <span className="truncate">{`${TOOL_NAMES[summary.tool]}: ${summary.label}`}</span>
            </li>
          ))}
        </ul>

        <button
          aria-controls="access-help-body"
          aria-expanded={open}
          className={cn(
            "ml-auto inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500",
            open
              ? "bg-cyan-500/15 text-cyan-700 ring-1 ring-inset ring-cyan-500/30 dark:text-cyan-300"
              : "text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800 dark:hover:text-white",
          )}
          onClick={() => setOpen((prev) => !prev)}
          type="button"
        >
          {open ? "Close" : "Manage"}
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className={cn("h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {/*
        Collapsed, the body is 0 rows tall, invisible and inert: out of the tab
        order and the accessibility tree. Same pattern as the search drawer.
      */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity,visibility] duration-200 ease-out motion-reduce:transition-none",
          open ? "visible grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0",
        )}
        data-state={open ? "open" : "closed"}
        id="access-help-body"
        inert={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <form action={action} className="border-t border-slate-200 px-4 pb-4 pt-4 dark:border-slate-800">
            <input type="hidden" name="csrfToken" value={csrfToken} />
            <fieldset className="grid gap-2.5 sm:grid-cols-3" aria-label="Choose access requests">
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
                    className="flex min-w-0 cursor-pointer flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-cyan-400/60 has-checked:border-cyan-500 has-checked:bg-cyan-500/8 has-checked:ring-1 has-checked:ring-cyan-500/30 has-disabled:cursor-not-allowed has-disabled:opacity-60 has-disabled:hover:border-slate-200 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-cyan-500/50 dark:has-disabled:hover:border-slate-800"
                  >
                    <span className="flex items-center gap-2.5">
                      <input
                        aria-describedby={notice ? hintId : undefined}
                        aria-label={choice.label}
                        className="size-4 shrink-0 accent-cyan-600"
                        type="checkbox"
                        name="requestTypes"
                        value={choice.value}
                        disabled={disabled}
                      />
                      <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {choice.label}
                      </span>
                    </span>
                    <span className="flex min-h-5 items-center justify-between gap-2 pl-6.5">
                      <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {TILE_DETAIL[choice.value]}
                      </span>
                      {notice ? (
                        <span
                          className="shrink-0 truncate rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          id={hintId}
                        >
                          {notice.chip}
                        </span>
                      ) : latest ? (
                        <StatusChip status={latest.status} sentAt={latest.sentAt} />
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <p
                role={message.tone === "muted" ? undefined : message.tone === "error" ? "alert" : "status"}
                title={message.text}
                className={cn(
                  "min-w-0 text-xs sm:truncate",
                  message.tone === "error" && "text-red-600 dark:text-red-400",
                  message.tone === "success" && "text-emerald-600 dark:text-emerald-400",
                  message.tone === "warning" && "text-amber-600 dark:text-amber-400",
                  message.tone === "muted" && "text-slate-500 dark:text-slate-400",
                )}
              >
                {message.text}
              </p>
              <PendingSubmitButton
                label="Request access"
                pendingLabel="Submitting…"
                className="w-full shrink-0 sm:w-auto sm:px-5"
              />
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
