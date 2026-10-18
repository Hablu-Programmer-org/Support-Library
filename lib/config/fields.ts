/**
 * Shared class strings for native form controls (filter/search/detail forms).
 * Native <select>/<input> are required by e2e tests (case-filters.spec),
 * so they are styled here to match the HeroUI Input/Textarea treatment
 * defined in app/globals.css: soft-fill at rest, subtle border on hover,
 * white fill + cyan border + soft cyan ring on focus.
 */

const disabledClasses = "disabled:cursor-not-allowed disabled:opacity-60";

export const nativeFieldClass = [
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900",
  "outline-none transition-all duration-200 placeholder:text-slate-400",
  "hover:border-slate-300 hover:bg-slate-50",
  "focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-500/20",
  "dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500",
  "dark:hover:border-slate-600 dark:hover:bg-slate-800",
  "dark:focus:border-cyan-500 dark:focus:bg-slate-900",
  disabledClasses,
].join(" ");

/** nativeFieldClass + custom chevron (see .select-chevron in app/globals.css). */
export const nativeSelectClass = `${nativeFieldClass} select-chevron`;

export const nativeTextareaClass = `${nativeFieldClass} min-h-24 resize-y`;

/**
 * Same as nativeTextareaClass but with a much lower height floor, for compact
 * multi-line fields that should not reserve a large empty box.
 */
export const nativeTextareaCompactClass = `${nativeFieldClass} min-h-11 resize-y`;

export const nativeLabelClass =
  "flex flex-col gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400";
