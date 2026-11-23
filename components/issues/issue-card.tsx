import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { ArrowRightIcon } from "@/components/icons";
import { StatusBadge } from "@/components/issues/status-badge";
import { LIVE_SUPPORT_ELIGIBLE_STATUSES } from "@/lib/constants";
import { formatSupportShortDate } from "@/lib/format-date";
import type { CaseStatus } from "@/models";

/** Tags shown inline; the rest collapse into a "+N" chip so a card keeps one row. */
export const ISSUE_CARD_MAX_TAGS = 3;

/** Entrance stagger: each of the first cards waits one step more than the last. */
export const ISSUE_CARD_STAGGER_MS = 40;
/** Cards at or past this index share the last delay, so a 20-row page never drags. */
export const ISSUE_CARD_STAGGER_STEPS = 8;

/** Entrance delay in ms for the card at `index` (0-based); bad input means no delay. */
export function issueCardEnterDelay(index: number): number {
  if (!Number.isFinite(index) || index <= 0) return 0;
  return Math.min(Math.trunc(index), ISSUE_CARD_STAGGER_STEPS - 1) * ISSUE_CARD_STAGGER_MS;
}

export type IssueCardStaff = {
  caseRef: string | null;
  studentName: string;
  studentEmail: string | null;
  replyLabel: "Student replied" | "No reply yet" | null;
  waitingLive: boolean;
};

/** The fields the staff line reads. Public rows type these as absent/`never`. */
type IssueCardStaffSource = {
  id: string;
  status: CaseStatus;
  caseRef?: string | null;
  studentName?: string;
  studentEmail?: string | null;
  awaitingStaff?: boolean;
  lastStaffReplyAt?: Date | null;
};

/**
 * Staff-only card data, or `undefined` for everyone else.
 *
 * The role decision is made here, on the server, from `canManage`, never from
 * which fields happen to be present on the row, so a student can never get the
 * staff line even if a projection someday carries an extra field.
 */
export function buildIssueCardStaff(
  item: IssueCardStaffSource,
  { canManage, waitingIds }: { canManage: boolean; waitingIds: ReadonlySet<string> },
): IssueCardStaff | undefined {
  if (!canManage) return undefined;
  return {
    caseRef: item.caseRef ?? null,
    studentName: item.studentName || "Unknown student",
    studentEmail: item.studentEmail ?? null,
    replyLabel:
      item.awaitingStaff === true
        ? item.lastStaffReplyAt
          ? "Student replied"
          : "No reply yet"
        : null,
    waitingLive:
      waitingIds.has(item.id) &&
      (LIVE_SUPPORT_ELIGIBLE_STATUSES as readonly string[]).includes(item.status),
  };
}

/** Left accent strip, one hue per status (matches StatusBadge). */
const accentClass: Record<CaseStatus, string> = {
  OPEN: "from-cyan-400 to-cyan-600",
  SOLVED: "from-emerald-400 to-emerald-600",
  PENDING: "from-amber-400 to-amber-600",
  AWAITING_STUDENT: "from-orange-400 to-orange-600",
  FOLLOW_UP: "from-violet-400 to-violet-600",
  ARCHIVED: "from-slate-300 to-slate-500 dark:from-slate-600 dark:to-slate-700",
};

export type IssueCardProps = {
  href: string;
  title: string;
  question: string;
  status: CaseStatus;
  tags: string[];
  courseSlug?: string | null;
  /** LMS display name for `courseSlug`; the slug shows when it is missing. */
  courseName?: string | null;
  batchNo?: number | null;
  /** The date shown on the card (staff: last update; readers: last answer). */
  updatedAt?: Date | string | null;
  /** Word before the date, e.g. "Answered". */
  datePrefix?: string;
  /**
   * Library readers: SOLVED is the normal state there, so a solved card drops
   * its badge and accent strip and only the exceptions (Open, Pending…) stand out.
   */
  quietSolved?: boolean;
  /** Present only for staff; build it with `buildIssueCardStaff`. */
  staff?: IssueCardStaff;
  /** Row actions (delete/archive). Rendered above the card's stretched link. */
  actions?: ReactNode;
  /** Position in the list; drives the staggered entrance. Omit for no delay. */
  enterIndex?: number;
};

/**
 * One issue in the list.
 *
 * A server component on purpose: no row data is serialized to the browser, and
 * the hover lift is pure CSS, so the card is fully visible without JavaScript.
 * The title link is stretched over the whole card (`after:inset-0`), which keeps
 * the actions real buttons instead of buttons nested inside a link.
 */
/** Case, spacing and edge punctuation (incl. the Bengali dari) ignored. */
const comparable = (text: string) =>
  text
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, "");

/** A question that only repeats the title adds a second copy, not a preview. */
export const repeatsTitle = (title: string, question: string) =>
  comparable(title) === comparable(question);

export function IssueCard({
  href,
  title,
  question,
  status,
  tags,
  courseSlug,
  courseName,
  batchNo,
  updatedAt,
  datePrefix,
  quietSolved = false,
  staff,
  actions,
  enterIndex = 0,
}: IssueCardProps) {
  const enterStyle = {
    "--issue-card-delay": `${issueCardEnterDelay(enterIndex)}ms`,
  } as CSSProperties;
  const visibleTags = tags.slice(0, ISSUE_CARD_MAX_TAGS);
  const hiddenTagCount = tags.length - visibleTags.length;
  const dateLabel = formatSupportShortDate(updatedAt);
  const dateIso = dateLabel && updatedAt ? new Date(updatedAt).toISOString() : undefined;
  const showStatus = !(quietSolved && status === "SOLVED");
  const courseLabel = [courseName || courseSlug, batchNo ? `Batch ${batchNo}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      data-testid="issue-card"
      style={enterStyle}
      className="issue-card-in group relative isolate overflow-hidden rounded-2xl border border-slate-200 bg-white py-4 pl-5 pr-4 shadow-sm transition duration-200 ease-out hover:border-cyan-400/60 hover:shadow-lg hover:shadow-cyan-500/10 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-cyan-500 has-[a:focus-visible]:ring-offset-2 has-[a:focus-visible]:ring-offset-white motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-cyan-500/50 dark:has-[a:focus-visible]:ring-offset-slate-950"
    >
      {/* Soft brand glow that fades in on hover; decorative only. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-cyan-500/4 opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none"
      />
      {showStatus && (
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 w-1 bg-linear-to-b ${accentClass[status]}`}
        />
      )}

      {/* Title row: the h2 holds the title only, its badges are siblings. */}
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <h2 className="min-w-0 basis-full text-base font-semibold leading-snug text-slate-900 wrap-break-word line-clamp-2 sm:basis-0 sm:flex-1 dark:text-slate-50">
          <Link
            href={href}
            className="outline-none after:absolute after:inset-0 after:content-[''] group-hover:text-cyan-700 dark:group-hover:text-cyan-300"
          >
            {title}
          </Link>
        </h2>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {showStatus && <StatusBadge status={status} />}
          {staff?.replyLabel && (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              {staff.replyLabel}
            </span>
          )}
          {staff?.waitingLive && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-100 px-2 py-1 text-xs font-semibold text-success-700 dark:bg-success-50/50 dark:text-success-300">
              <span aria-hidden="true" className="relative flex size-1.5">
                <span className="absolute inline-flex size-full rounded-full bg-success-500 opacity-75 motion-safe:animate-ping" />
                <span className="relative inline-flex size-1.5 rounded-full bg-success-500" />
              </span>
              Waiting in live support
            </span>
          )}
        </div>
      </div>

      {!repeatsTitle(title, question) && (
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600 wrap-break-word line-clamp-2 dark:text-slate-400">
          {question}
        </p>
      )}

      {staff && (
        <p className="mt-2 text-xs text-slate-500 wrap-break-word dark:text-slate-400">
          {staff.caseRef && (
            <>
              <span className="font-mono font-semibold">{staff.caseRef}</span>
              {" · "}
            </>
          )}
          {staff.studentName}
          {staff.studentEmail ? ` · ${staff.studentEmail}` : ""}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
        {visibleTags.length > 0 && (
          <ul className="flex min-w-0 flex-wrap gap-1.5" aria-label="Tags">
            {visibleTags.map((tag) => (
              <li
                key={tag}
                className="max-w-40 truncate rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                #{tag}
              </li>
            ))}
            {hiddenTagCount > 0 && (
              <li className="rounded-md px-1.5 py-0.5 font-medium text-slate-500 dark:text-slate-400">
                +{hiddenTagCount}
              </li>
            )}
          </ul>
        )}
        {courseLabel && <span className="truncate">{courseLabel}</span>}

        <div className="ml-auto flex items-center gap-3">
          {dateLabel && (
            <span>
              {datePrefix && `${datePrefix} `}
              <time dateTime={dateIso}>{dateLabel}</time>
            </span>
          )}
          {actions && <div className="relative z-10">{actions}</div>}
          <ArrowRightIcon
            size={16}
            className="text-slate-400 transition duration-200 group-hover:text-cyan-500 motion-safe:group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </div>
      </div>
    </article>
  );
}
