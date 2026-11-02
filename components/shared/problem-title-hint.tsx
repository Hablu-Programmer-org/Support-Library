import { cn } from "@/lib/cn";

/**
 * The helper + live counter under a problem title.
 *
 * The counter is the only coloured part: slate normally, amber once the title
 * is getting long, danger at the limit. Prevents the field silently refusing a
 * paste at 81 characters.
 */
export function ProblemTitleHint({
  length,
  max,
  warnAt,
}: {
  length: number;
  max: number;
  warnAt: number;
}) {
  const tone =
    length >= max
      ? "text-danger-600 dark:text-danger-400"
      : length >= warnAt
        ? "text-warning-700 dark:text-warning-400"
        : "text-slate-500 dark:text-slate-400";

  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        One line, {max} characters max. Name the problem, not the topic.
      </p>
      <span
        aria-live="polite"
        className={cn("shrink-0 text-xs tabular-nums", tone)}
      >
        {length}/{max}
      </span>
    </div>
  );
}
