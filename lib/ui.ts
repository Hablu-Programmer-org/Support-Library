/**
 * Shared visual tokens for the Support Library UI.
 *
 * The app already leans on Tailwind's slate/cyan palette, so these are class
 * strings rather than CSS variables: every surface uses the same border,
 * radius, elevation and hover treatment, and a page cannot drift by inventing
 * one-off styles. Add a token here instead of copying a long className chain.
 */

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950";

/** Base card: quiet border, one elevation step, no glow. */
export const surfaceClass =
  "rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900/60";

/** Card header row that sits on top of a divided body. */
export const surfaceHeaderClass =
  "flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800";

/** Interactive row inside a surface: colour-only feedback, no layout shift. */
export const rowHoverClass =
  "transition-colors duration-150 hover:bg-slate-50 focus-within:bg-slate-50 motion-reduce:transition-none dark:hover:bg-slate-800/40 dark:focus-within:bg-slate-800/40";

export const primaryButtonClass = [
  "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white",
  "shadow-sm transition-colors duration-150 hover:bg-primary-600 active:bg-primary-700",
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none",
  "motion-reduce:transition-none",
  focusRing,
].join(" ");

export const secondaryButtonClass = [
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold",
  "text-slate-700 transition-colors duration-150 hover:border-slate-400 hover:bg-slate-50",
  "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800",
  "motion-reduce:transition-none",
  focusRing,
].join(" ");

export const subtleButtonClass = [
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold",
  "text-slate-600 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900",
  "dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
  "motion-reduce:transition-none",
  focusRing,
].join(" ");

/** Section eyebrow above a heading or page title. */
export const eyebrowClass =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400";

/** Neutral metadata chip (request type, batch, admin-created). */
export const chipClass =
  "inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300";

/** Focus treatment for links and custom controls that are not buttons. */
export const focusRingClass = focusRing;

export const mutedTextClass = "text-slate-500 dark:text-slate-400";
