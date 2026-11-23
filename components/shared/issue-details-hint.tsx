import { CheckCircleIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import {
  ISSUE_DETAILS_CREATE_MIN,
  ISSUE_DETAILS_MAX,
} from "@/lib/constants";
import {
  isIssueDetailsTooLong,
  issueDetailsCharacterCount,
  issueDetailsLength,
} from "@/lib/issue-content-rules";

/** Stable helper row for create/edit detail fields. */
export function IssueDetailsHint({
  value,
  requireCreateMinimum = true,
}: {
  value: string;
  requireCreateMinimum?: boolean;
}) {
  const tooLong = isIssueDetailsTooLong(value);
  // Over the cap, show the length the server measures so the number and the
  // message agree; otherwise the whitespace-collapsed count used for the minimum.
  const count = tooLong ? issueDetailsLength(value) : issueDetailsCharacterCount(value);
  const enough = !requireCreateMinimum || count >= ISSUE_DETAILS_CREATE_MIN;

  return (
    <div className="flex min-h-5 items-center justify-between gap-3 text-xs">
      <span
        className={cn(
          "inline-flex min-w-0 items-center gap-1.5",
          tooLong
            ? "text-danger-600 dark:text-danger-400"
            : enough
              ? "text-success-700 dark:text-success-300"
              : "text-warning-700 dark:text-warning-300",
        )}
      >
        {enough && requireCreateMinimum && !tooLong ? <CheckCircleIcon size={13} /> : null}
        {tooLong
          ? `Shorten by ${(count - ISSUE_DETAILS_MAX).toLocaleString("en-US")} characters.`
          : requireCreateMinimum
            ? enough
              ? "Enough detail for the support team."
              : `Add at least ${ISSUE_DETAILS_CREATE_MIN} characters.`
            : "Describe the issue clearly for the support team."}
      </span>
      <span
        className={cn(
          "shrink-0 tabular-nums",
          tooLong ? "font-semibold text-danger-600 dark:text-danger-400" : "text-slate-500 dark:text-slate-400",
        )}
      >
        {count.toLocaleString("en-US")}/{ISSUE_DETAILS_MAX.toLocaleString("en-US")}
      </span>
    </div>
  );
}
