import Link from "next/link";
import type { CSSProperties } from "react";

import { CheckCircleIcon, MessageSquareIcon, SendIcon } from "@/components/icons";
import { issueCardEnterDelay } from "@/components/issues/issue-card";
import { StatusBadge } from "@/components/issues/status-badge";
import { LIVE_SUPPORT_ELIGIBLE_STATUSES } from "@/lib/constants";
import { formatSupportDate, formatSupportRelative } from "@/lib/format-date";
import { type MyIssuesGroup, statusGroup } from "@/lib/my-issues-view";
import type { SupportIssueListItem } from "@/lib/services/issues";
import type { CaseStatus } from "@/models";

export type MyIssueCta = "Reply now" | "Join live" | "View reply" | "Open";

/**
 * The one next step a row offers, first match wins:
 * the team is waiting on the student → reply; the live room is open for this
 * case → join; the team has answered → read it; otherwise just open it.
 */
export function myIssueCta({
  status,
  live,
  teamReplied,
}: {
  status: CaseStatus;
  live: boolean;
  teamReplied: boolean;
}): MyIssueCta {
  if (status === "AWAITING_STUDENT") return "Reply now";
  if (live) return "Join live";
  if (teamReplied) return "View reply";
  return "Open";
}

/** "Live now" needs both: the room is in a shift and the case may join it. */
export function isLiveEligible(status: CaseStatus, roomOpen: boolean): boolean {
  return roomOpen && (LIVE_SUPPORT_ELIGIBLE_STATUSES as readonly string[]).includes(status);
}

const groupTile: Record<MyIssuesGroup, string> = {
  action: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  active: "bg-cyan-100 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300",
  closed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
};

const groupIcon: Record<MyIssuesGroup, typeof SendIcon> = {
  action: SendIcon,
  active: MessageSquareIcon,
  closed: CheckCircleIcon,
};

const ctaClass: Record<MyIssueCta, string> = {
  "Reply now": "bg-amber-700 text-white dark:bg-amber-400 dark:text-amber-950",
  "Join live": "bg-cyan-700 text-white dark:bg-cyan-400 dark:text-cyan-950",
  "View reply":
    "border border-slate-200 text-cyan-700 group-hover:border-cyan-400/60 dark:border-slate-700 dark:text-cyan-300",
  Open: "border border-slate-200 text-cyan-700 group-hover:border-cyan-400/60 dark:border-slate-700 dark:text-cyan-300",
};

export type MyIssueCardIssue = Pick<
  SupportIssueListItem,
  | "id"
  | "title"
  | "status"
  | "caseRef"
  | "courseSlug"
  | "batchNo"
  | "moduleSlug"
  | "uploads"
  | "createdAt"
  | "updatedAt"
  | "lastStaffReplyAt"
>;

export type MyIssueCardProps = {
  issue: MyIssueCardIssue;
  /** Whether the live room is in a shift right now (server clock). */
  roomOpen: boolean;
  /** Server render time; relative ages are computed once, on the server. */
  now: Date;
  enterIndex?: number;
};

/**
 * One of the student's own issues on "My issues".
 *
 * A server component, like `IssueCard`: the title link is stretched over the
 * whole card, so the card has exactly one interactive element and the CTA is a
 * visual cue for that same link (its text is repeated for screen readers).
 */
export function MyIssueCard({ issue, roomOpen, now, enterIndex = 0 }: MyIssueCardProps) {
  const group = statusGroup(issue.status);
  const Icon = groupIcon[group];
  // "Team replied", not "New": the app keeps no read receipt, so an unread
  // claim would stay on screen after the answer was read.
  const teamReplied = Boolean(issue.lastStaffReplyAt);
  const live = isLiveEligible(issue.status, roomOpen);
  const cta = myIssueCta({ status: issue.status, live, teamReplied });

  const when = teamReplied ? issue.lastStaffReplyAt : (issue.updatedAt ?? issue.createdAt);
  const age = formatSupportRelative(when, now);
  const fileCount = issue.uploads?.length ?? 0;
  const courseLabel = [
    issue.courseSlug,
    issue.batchNo ? `Batch ${issue.batchNo}` : null,
    issue.moduleSlug,
  ]
    .filter(Boolean)
    .join(" · ");

  const enterStyle = {
    "--issue-card-delay": `${issueCardEnterDelay(enterIndex)}ms`,
  } as CSSProperties;

  return (
    <article
      data-testid="my-issue-card"
      data-group={group}
      style={enterStyle}
      className={`issue-card-in group relative isolate flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border bg-white p-4 shadow-sm transition duration-200 ease-out hover:shadow-lg hover:shadow-cyan-500/10 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-cyan-500 has-[a:focus-visible]:ring-offset-2 has-[a:focus-visible]:ring-offset-white motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none sm:p-5 dark:bg-slate-900/70 dark:has-[a:focus-visible]:ring-offset-slate-950 ${
        group === "action"
          ? "border-amber-300 dark:border-amber-400/40"
          : "border-slate-200 hover:border-cyan-400/60 dark:border-slate-800 dark:hover:border-cyan-500/50"
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex size-11 shrink-0 items-center justify-center self-start rounded-xl ${groupTile[group]}`}
      >
        <Icon size={20} />
      </span>

      <div className="min-w-0 flex-[999_1_15rem] space-y-2">
        <h2 className="text-base font-semibold leading-snug text-slate-900 wrap-break-word line-clamp-2 dark:text-slate-50">
          <Link
            href={`/dashboard/issues/${issue.id}`}
            className="outline-none after:absolute after:inset-0 after:content-[''] group-hover:text-cyan-700 dark:group-hover:text-cyan-300"
          >
            {issue.title}
            <span className="sr-only"> — {cta}</span>
          </Link>
        </h2>

        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={issue.status} viewer="owner" />
          {teamReplied && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-100 px-2 py-1 text-xs font-semibold text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-200">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-cyan-500" />
              Team replied
            </span>
          )}
          {live && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-100 px-2 py-1 text-xs font-semibold text-success-700 dark:bg-success-50/50 dark:text-success-300">
              <span aria-hidden="true" className="relative flex size-1.5">
                <span className="absolute inline-flex size-full rounded-full bg-success-500 opacity-75 motion-safe:animate-ping" />
                <span className="relative inline-flex size-1.5 rounded-full bg-success-500" />
              </span>
              Live now
            </span>
          )}
        </div>

        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
          {issue.caseRef ? (
            <span className="relative z-10 select-all font-mono font-semibold">{issue.caseRef}</span>
          ) : (
            <span aria-label="No case reference">—</span>
          )}
          {courseLabel && (
            <>
              <span aria-hidden="true">·</span>
              <span className="min-w-0 truncate">{courseLabel}</span>
            </>
          )}
          {fileCount > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                {fileCount} {fileCount === 1 ? "file" : "files"}
              </span>
            </>
          )}
          {age && when && (
            <>
              <span aria-hidden="true">·</span>
              <time dateTime={new Date(when).toISOString()} title={formatSupportDate(when)}>
                {teamReplied ? "Replied" : "Updated"} {age}
              </time>
            </>
          )}
        </p>
      </div>

      <span
        aria-hidden="true"
        className={`inline-flex min-h-10 flex-[1_0_auto] items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold whitespace-nowrap transition sm:flex-none ${ctaClass[cta]}`}
      >
        {cta}
        <span className="transition motion-safe:group-hover:translate-x-0.5">→</span>
      </span>
    </article>
  );
}
