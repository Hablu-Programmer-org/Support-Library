import { IssueTimeline } from "@/components/issues/issue-timeline";
import { SectionLabel } from "@/components/shared/section-label";
import type { UserRole } from "@/lib/roles";
import type { SupportReplyListItem } from "@/lib/services/replies";
import type { CaseStatus } from "@/models";

type IssueThreadProps = {
  issueId: string;
  status: CaseStatus;
  replies: SupportReplyListItem[];
  viewerId: string;
  viewerRole?: UserRole | null;
  csrfToken: string;
  /** Staff view. `false` is the Student Library (public) view. */
  canEdit: boolean;
};

/**
 * Every reply in one "Responses" list, oldest first. On a solved case the first
 * reply is the answer the team stands behind, so it carries the Solution mark.
 * Edit and delete rights are still decided per reply inside `IssueTimeline`.
 */
export function IssueThread({
  issueId,
  status,
  replies,
  viewerId,
  viewerRole,
  csrfToken,
  canEdit,
}: IssueThreadProps) {
  const solutionReplyId = status === "SOLVED" ? replies[0]?.id : undefined;

  return (
    <section aria-labelledby="responses-heading" className="space-y-3">
      <div className="flex items-center gap-2">
        <SectionLabel id="responses-heading">Responses</SectionLabel>
        {replies.length > 0 ? (
          // Outside the h2 so the heading's accessible name stays "Responses".
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {replies.length}
          </span>
        ) : null}
      </div>
      <IssueTimeline
        issueId={issueId}
        replies={replies}
        viewerId={viewerId}
        viewerRole={viewerRole}
        csrfToken={csrfToken}
        publicView={!canEdit}
        solutionReplyId={solutionReplyId}
      />
    </section>
  );
}
