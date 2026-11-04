import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import {
  deleteIssueAction,
} from "@/actions/issues";
import { ArchiveIssueButton } from "@/components/issues/archive-issue-button";
import { CopyForAiButton } from "@/components/issues/copy-for-ai-button";
import { IssueStatusForm } from "@/components/issues/issue-status-form";
import { PublishIssueForm } from "@/components/issues/publish-issue-form";
import { StudentRequestView } from "@/components/issues/student-request-view";
import { IssueTimeline } from "@/components/issues/issue-timeline";
import { ReplyComposer } from "@/components/issues/reply-composer";
import { StatusBadge } from "@/components/issues/status-badge";
import { AttachmentList } from "@/components/shared/attachment-list";
import { CopyValue } from "@/components/shared/copy-value";
import { LinkList } from "@/components/shared/link-list";
import { SectionLabel } from "@/components/shared/section-label";
import {
  ArrowLeftIcon,
  PencilIcon,
  SettingsIcon,
  UserIcon,
  WarningTriangleIcon,
} from "@/components/icons";
import { requireSession } from "@/lib/auth-guard";
import { formatSupportDate } from "@/lib/format-date";
import {
  ISSUES_PATH,
  buildIssueEditHref,
  parseIssueListReturnTo,
} from "@/lib/issue-list-params";
import { canMutate, isAdmin } from "@/lib/roles";
import { getOwnIssueActivitySnapshot } from "@/lib/services/issue-activity";
import { getIssueDetail, getOwnIssueDetail, getPublishedIssueDetail } from "@/lib/services/issues";
import { listReplies } from "@/lib/services/replies";
import { CASE_STATUSES } from "@/models";
import { generateCsrfToken } from "@/lib/csrf";
import { buildIssueResponsePrompt } from "@/lib/issue-response-prompt";

export const dynamic = "force-dynamic";

const statusLabels = {
  OPEN: "Open",
  SOLVED: "Solved",
  PENDING: "Pending",
  AWAITING_STUDENT: "Needs your reply",
  FOLLOW_UP: "Follow-up",
  ARCHIVED: "Archived",
};

const priorityLabels: Record<string, string> = {
  LOW: "Low priority",
  NORMAL: "Normal priority",
  HIGH: "High priority",
  URGENT: "Urgent",
};

export default async function IssueDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ created?: string; returnTo?: string }>;
}) {
  const { id } = await params;
  const { created, returnTo: rawReturnTo } = (await searchParams) ?? {};
  const session = await requireSession();
  const canEdit = Boolean(session.user.role && canMutate(session.user.role));
  const canPublish = isAdmin(session.user.role ?? "STUDENT");
  // The list URL the viewer arrived from (filters + page), validated and rebuilt
  // server-side. `null` means "no list context" — a direct link, a bookmark or a
  // dashboard-home row — and the back link falls back to the plain list.
  const returnTo = parseIssueListReturnTo(rawReturnTo, { canManage: canEdit });
  const backHref = returnTo ?? ISSUES_PATH;
  const backLabel =
    returnTo === "/dashboard"
      ? "Back to dashboard"
      : returnTo
        ? "Back to results"
        : "Back to Issues";
  const staffIssue = canEdit ? await getIssueDetail(id) : null;

  if (!staffIssue) {
    // A student may read their own request whatever its visibility. Anyone else
    // still falls through to the published library or a 404, so an unpublished
    // case never opens up. Ownership comes from `createdBy`, not the URL.
    const ownedIssue = await getOwnIssueDetail(id, session.user.id);
    if (ownedIssue) {
      const [replies, csrfToken, activity] = await Promise.all([
        listReplies(ownedIssue.id, { viewerId: session.user.id ?? undefined, redactActorIds: true }),
        generateCsrfToken(session.user.id),
        getOwnIssueActivitySnapshot(session.user.id),
      ]);

      return (
        <StudentRequestView
          activityRevision={activity.revision}
          created={created === "1"}
          csrfToken={csrfToken}
          issue={ownedIssue}
          replies={replies}

        />
      );
    }
  }

  const supportIssue = staffIssue ?? (await getPublishedIssueDetail(id));
  if (!supportIssue) notFound();

  const replies = await listReplies(supportIssue.id, { redactActorIds: !canEdit });
  const csrfToken = await generateCsrfToken(session.user.id);

  // Admin-only: the prompt carries the full thread, which mentors can read but
  // only admins may hand to an external assistant. It is built from an explicit
  // allowlist on the server, never scraped from the rendered page, and contains
  // no student identity, internal ids or private attachment URLs.
  const aiPrompt =
    canPublish && staffIssue
      ? buildIssueResponsePrompt({
          issue: {
            title: staffIssue.title,
            question: staffIssue.question,
            status: staffIssue.status,
            priority: staffIssue.priority,
            courseSlug: staffIssue.courseSlug,
            batchNo: staffIssue.batchNo,
            moduleSlug: staffIssue.moduleSlug,
            contentSlug: staffIssue.contentSlug,
            tags: staffIssue.tags,
            createdAt: staffIssue.createdAt,
            updatedAt: staffIssue.updatedAt,
            videoLinks: staffIssue.videoLinks,
            attachments: staffIssue.uploads.map((upload) => ({
              mimeType: upload.mimeType,
            })),
          },
          replies: replies.map((reply) => ({
            isStaffReply: reply.isStaffReply,
            body: reply.body,
            createdAt: reply.createdAt,
            videoLinks: reply.videoLinks,
            attachments: reply.uploads.map((upload) => ({ mimeType: upload.mimeType })),
          })),
        })
      : null;

  return (
    <div className="mx-auto w-full max-w-6xl py-6">
      <Link
        href={backHref}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-primary transition hover:text-primary-600 hover:underline"
      >
        <ArrowLeftIcon size={18} />
        {backLabel}
      </Link>

      <header className="mb-8 border-b border-slate-200 pb-8 dark:border-slate-800">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <StatusBadge status={supportIssue.status} />
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {priorityLabels[supportIssue.priority ?? "NORMAL"] ??
              supportIssue.priority}
          </span>
          {supportIssue.visibility === "PUBLISHED" && (
            <span className="rounded-full bg-success-100 px-2.5 py-1 font-medium text-success-700 dark:bg-success-950/50 dark:text-success-200">
              Student Library
            </span>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="max-w-4xl text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              {supportIssue.title}
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Updated{" "}
              <time dateTime={supportIssue.updatedAt?.toISOString()}>
                {formatSupportDate(supportIssue.updatedAt)}
              </time>
            </p>
          </div>

          {canEdit && (
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-start">
              {aiPrompt ? <CopyForAiButton prompt={aiPrompt} /> : null}
              {/* Editing the case is a page-level action: keep it beside the title so
                  it stays reachable before the sidebar is scrolled into view. */}
              <Link
                href={buildIssueEditHref(supportIssue.id, returnTo)}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <PencilIcon size={16} />
                Edit issue details
              </Link>
            </div>
          )}
        </div>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="min-w-0 space-y-10">
          <section aria-labelledby="problem-heading">
            <SectionLabel id="problem-heading">The problem</SectionLabel>
            <div className="mt-3 space-y-4">
              <p className="max-w-3xl whitespace-pre-wrap wrap-break-word text-base leading-8 text-slate-800 dark:text-slate-100 sm:text-lg">
                {supportIssue.question}
              </p>
              <LinkList videoLinks={supportIssue.videoLinks} />
              {/* `staffIssue` is set only for staff; the published projection has
                  no uploads at all, so students never receive their ids. */}
              <AttachmentList uploads={staffIssue?.uploads ?? []} />
              {supportIssue.tags.length > 0 && (
                <div
                  className="mt-7 flex flex-wrap gap-2"
                  aria-label="Issue tags"
                >
                  {supportIssue.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          <div className="space-y-8 border-t border-slate-200 pt-8 dark:border-slate-800">
            {replies.length > 0 ? (
              <>
                <section aria-labelledby="answer-heading">
                  <SectionLabel id="answer-heading">
                    {supportIssue.status === "SOLVED" ? "Solution" : "Answer"}
                  </SectionLabel>
                  <div className="mt-2">
                    <IssueTimeline
                      issueId={supportIssue.id}
                      replies={[replies[0]]}
                      viewerId={session.user.id}
                      viewerRole={session.user.role}
                      csrfToken={csrfToken}
                      variant="solution"
                    />
                  </div>
                </section>

                {replies.length > 1 && (
                  <section
                    aria-labelledby="responses-heading"
                    className="border-t border-slate-200 pt-8 dark:border-slate-800"
                  >
                    <SectionLabel id="responses-heading">
                      Responses
                    </SectionLabel>
                    <div className="mt-2">
                      <IssueTimeline
                        issueId={supportIssue.id}
                        replies={replies.slice(1)}
                        viewerId={session.user.id}
                        viewerRole={session.user.role}
                        csrfToken={csrfToken}
                      />
                    </div>
                  </section>
                )}
              </>
            ) : (
              <section aria-labelledby="responses-heading">
                <SectionLabel id="responses-heading">Responses</SectionLabel>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  No answer yet. The team replies by email too.
                </p>
              </section>
            )}
          </div>

          {canEdit && (
            <div className="border-t border-slate-200 pt-8 dark:border-slate-800">
              <ReplyComposer
                issueId={supportIssue.id}
                csrfToken={csrfToken}
                returnTo={returnTo ?? undefined}
              />
            </div>
          )}
        </main>

        <aside className="space-y-0 lg:sticky lg:top-20">
          <section className="border-t border-slate-200 py-6 first:border-t-0 first:pt-0 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <SettingsIcon className="text-slate-400" size={16} />
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Issue context
              </h2>
            </div>
            <dl className="mt-3 space-y-3 text-sm">
              {staffIssue && (
                <Info
                  label="Reference"
                  valueNode={
                    staffIssue.caseRef ? (
                      <CopyValue
                        label="reference"
                        value={staffIssue.caseRef}
                        variant="chip"
                      />
                    ) : (
                      "—"
                    )
                  }
                />
              )}
              <Info label="Course" value={supportIssue.courseSlug} />
              <Info label="Batch" value={supportIssue.batchNo?.toString()} />
              <Info
                label="Published"
                value={formatSupportDate(supportIssue.publishedAt)}
              />
              <Info
                label="Created"
                value={formatSupportDate(supportIssue.createdAt)}
              />
              {staffIssue && (
                <Info
                  label="Live support"
                  value={formatSupportDate(staffIssue.lastLiveSupportAt)}
                />
              )}
            </dl>
          </section>

          {staffIssue && (
            <section className="border-t border-slate-200 py-6 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <UserIcon className="text-slate-400" size={16} />
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                  Student snapshot
                </h2>
              </div>
              <p className="mt-3 wrap-break-word font-medium text-slate-900 dark:text-white">
                {staffIssue.studentName || "General issue (no student)"}
              </p>
              <p className="mt-1 break-all text-sm text-slate-500 dark:text-slate-400">
                {staffIssue.studentEmail ? (
                  <CopyValue label="student email" value={staffIssue.studentEmail} />
                ) : (
                  "No student identity recorded"
                )}
              </p>
            </section>
          )}

          {canEdit && (
            <section className="border-t border-slate-200 py-6 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Manage issue
              </h2>
              <IssueStatusForm
                autoPublish={canPublish}
                csrfToken={csrfToken}
                expectedUpdatedAt={supportIssue.updatedAt?.toISOString() ?? ""}
                issueId={supportIssue.id}
                isPublished={supportIssue.visibility === "PUBLISHED"}
                options={CASE_STATUSES.filter((status) => status !== "ARCHIVED").map(
                  (status) => ({ value: status, label: statusLabels[status] }),
                )}
                status={supportIssue.status}
              />

              {canPublish && (
                <PublishIssueForm
                  issueId={supportIssue.id}
                  reviewedAt={supportIssue.updatedAt?.toISOString() ?? ""}
                  isPublished={supportIssue.visibility === "PUBLISHED"}
                  csrfToken={csrfToken}
                  returnTo={returnTo ?? undefined}
                />
              )}
            </section>
          )}

          {canEdit && (
            <section className="border-t-2 border-danger-300 py-6 dark:border-danger-300/70">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-danger-600 text-white dark:bg-danger-300 dark:text-danger-900">
                  <WarningTriangleIcon size={21} />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-danger-600 dark:text-danger-700">
                    Danger zone
                  </p>
                  <h2 className="mt-0.5 text-base font-bold text-danger-900 dark:text-slate-50">
                    Archive this issue
                  </h2>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-danger-900/80 dark:text-slate-300">
                Remove this issue from active staff lists and the student
                library. Archive it only when no further action is needed.
              </p>
              <ArchiveIssueButton
                action={deleteIssueAction.bind(null, supportIssue.id)}
                csrfToken={csrfToken}
                returnTo={returnTo ?? undefined}
              />
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  valueNode,
}: {
  label: string;
  value?: string | null;
  valueNode?: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 wrap-break-word font-medium text-slate-800 dark:text-slate-200">
        {valueNode ?? value ?? "Not specified"}
      </dd>
    </div>
  );
}
