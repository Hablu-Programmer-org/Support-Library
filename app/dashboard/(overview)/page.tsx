import Link from "next/link";
import { redirect } from "next/navigation";

import { AwaitingMentorList } from "@/components/dashboard/awaiting-mentor-list";
import { StatusBreakdown } from "@/components/dashboard/status-breakdown";
import {
  CaseIcon,
  MessageSquareIcon,
  UserIcon,
  VideoIcon,
} from "@/components/icons";
import { LiveSupportJoinQueue } from "@/components/live-support/join-queue";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { AccessRequestSummary } from "@/components/tool-access/access-request-summary";
import { requireSession } from "@/lib/auth-guard";
import { currentShift, dayKeyInDhaka } from "@/lib/config/live-support";
import { formatSupportDateOnly } from "@/lib/format-date";
import { isN8nAdmin } from "@/lib/n8n-request-policy";
import { canMutate, isAdmin } from "@/lib/roles";
import {
  getDashboardStats,
  getTopTags,
  getUnresolvedStatusBreakdown,
} from "@/lib/services/analytics";
import {
  countStudentRequestsAwaitingStaff,
  listStudentRequestsAwaitingStaff,
} from "@/lib/services/issues";
import {
  countStillWaiting,
  listLiveSupportQueue,
} from "@/lib/services/live-support-joins";
import { countPendingN8nRequests } from "@/lib/services/n8n-requests";
import {
  chipClass,
  focusRingClass,
  primaryButtonClass,
  secondaryButtonClass,
  surfaceClass,
  surfaceHeaderClass,
} from "@/lib/ui";

export const dynamic = "force-dynamic";

const AWAITING_ROWS = 8;
/** A tag on a single issue is noise, not a trend. */
const TAG_MIN_COUNT = 2;
const TAG_ROWS = 8;

const SHIFT_LABEL = {
  morning: "Morning shift",
  night: "Night shift",
  off: "Off shift",
} as const;

export default async function DashboardPage() {
  const session = await requireSession();
  const role = session.user.role ?? "STUDENT";
  if (!canMutate(role)) redirect("/dashboard/issues");

  const now = new Date();
  const dayKey = dayKeyInDhaka(now);
  // The access queue is a separate admin surface with its own exact-role gate,
  // so the dashboard only advertises it to someone who can actually open it.
  const showAccessQueue =
    isAdmin(role) && (await isN8nAdmin(session.user.email));

  const [
    stats,
    breakdown,
    topTags,
    waiting,
    awaiting,
    awaitingTotal,
    accessCounts,
  ] = await Promise.all([
    getDashboardStats(false),
    getUnresolvedStatusBreakdown(),
    getTopTags(20, false),
    listLiveSupportQueue(dayKey),
    listStudentRequestsAwaitingStaff(AWAITING_ROWS),
    countStudentRequestsAwaitingStaff(),
    showAccessQueue
      ? Promise.all([
          countPendingN8nRequests(["OPENAI_ACCESS"]),
          countPendingN8nRequests(["ACCESS", "PASSWORD_RESET"]),
        ])
      : Promise.resolve(null),
  ]);
  // A join row survives after a case is solved, so the card counts only those
  // requests that are still unresolved (the room list stays a full log).
  const waitingNow = countStillWaiting(waiting);
  const tags = topTags
    .filter((item) => item.count >= TAG_MIN_COUNT)
    .slice(0, TAG_ROWS);

  return (
    <div className="space-y-5">
      <PageHeader
        action={
          <Link
            className={
              waitingNow > 0 ? primaryButtonClass : secondaryButtonClass
            }
            href="/dashboard/live-support"
          >
            Open live support
          </Link>
        }
        meta={
          <span className={chipClass}>
            {formatSupportDateOnly(now)} · {SHIFT_LABEL[currentShift(now)]}
          </span>
        }
        title="Dashboard"
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          hint="In the room, request still open"
          href="/dashboard/live-support"
          icon={<VideoIcon size={16} />}
          label="Waiting now"
          tone="success"
          value={waitingNow}
        />
        <StatCard
          hint="Student requests, no mentor yet"
          href="#awaiting-mentor-heading"
          icon={<UserIcon size={16} />}
          label="Needs a mentor"
          tone="warning"
          value={awaitingTotal}
        />
        <StatCard
          hint={`Of ${stats.totalIssues} total`}
          href="/dashboard/issues"
          icon={<MessageSquareIcon size={16} />}
          label="Unresolved"
          tone="primary"
          value={stats.unresolvedIssues}
        />
        <StatCard
          hint="Created in the last 7 days"
          icon={<CaseIcon size={16} />}
          label="New this week"
          value={stats.weeklyIssues}
        />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <AwaitingMentorList
            items={awaiting}
            now={now}
            total={awaitingTotal}
          />
          <StatusBreakdown counts={breakdown} />
        </div>

        <div className="space-y-5">
          <LiveSupportJoinQueue dayKey={dayKey} entries={waiting} />

          {accessCounts && (
            <AccessRequestSummary
              layout="stacked"
              n8nPending={accessCounts[1]}
              openAiPending={accessCounts[0]}
            />
          )}

          {tags.length > 0 && (
            <section
              aria-labelledby="top-tags-heading"
              className={surfaceClass}
            >
              <div className={surfaceHeaderClass}>
                <h2
                  className="text-sm font-semibold text-slate-900 dark:text-white"
                  id="top-tags-heading"
                >
                  Top tags
                </h2>
              </div>
              <ul className="flex flex-wrap gap-2 p-4">
                {tags.map((item) => (
                  <li key={item.tag}>
                    <Link
                      className={`inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition-colors duration-150 hover:bg-cyan-100 hover:text-cyan-800 motion-reduce:transition-none dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-cyan-900/40 dark:hover:text-cyan-200 ${focusRingClass}`}
                      href={`/dashboard/issues?tag=${encodeURIComponent(item.tag)}`}
                    >
                      {item.tag}
                      <span className="tabular-nums text-slate-500 dark:text-slate-400">
                        {item.count}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
