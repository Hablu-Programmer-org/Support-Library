import { CheckCircleIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import {
  ISSUE_DETAILS_CREATE_MIN,
  ISSUE_DETAILS_MAX,
} from "@/lib/constants";
import { issueDetailsCharacterCount } from "@/lib/issue-content-rules";

/** Stable helper row for create/edit detail fields. */
export function IssueDetailsHint({
  value,
  requireCreateMinimum = true,
}: {
  value: string;
  requireCreateMinimum?: boolean;
}) {
  const count = issueDetailsCharacterCount(value);
  const enough = !requireCreateMinimum || count >= ISSUE_DETAILS_CREATE_MIN;

  return (
    <div className="flex min-h-5 items-center justify-between gap-3 text-xs">
      <span
        className={cn(
          "inline-flex min-w-0 items-center gap-1.5",
          enough
            ? "text-success-700 dark:text-success-300"
            : "text-warning-700 dark:text-warning-300",
        )}
      >
        {enough && requireCreateMinimum ? <CheckCircleIcon size={13} /> : null}
        {requireCreateMinimum
          ? enough
            ? "Enough detail for the support team."
            : `Add at least ${ISSUE_DETAILS_CREATE_MIN} characters.`
          : "Describe the issue clearly for the support team."}
      </span>
      <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
        {count.toLocaleString("en-US")}/{ISSUE_DETAILS_MAX.toLocaleString("en-US")}
      </span>
    </div>
  );
}
