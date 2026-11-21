/**
 * Colour and shape classes for the topbar, the profile dropdown and the mobile
 * menu. Same roles as the LMS v2 `navStyles` (frontend/src/components/shared/
 * nav-styles.ts) so both apps read as one product, plus light-theme pairs
 * because this app keeps its theme toggle.
 *
 * The header surface (`bg-white/80 dark:bg-slate-950/80`) is asserted by
 * e2e/shell.spec.ts; change it there too if it ever moves.
 */
export const navStyles = {
  header:
    "border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80",
  focus:
    "outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 focus-visible:ring-offset-0",
  brandText: "text-slate-900 dark:text-slate-100",

  /** Desktop text link; full bar height so the underline sits on the bar's edge. */
  link: "relative flex h-16 items-center gap-1 text-[15px] font-medium transition-colors duration-150 motion-reduce:transition-none",
  linkIdle: "text-slate-600 hover:text-cyan-700 dark:text-slate-300 dark:hover:text-cyan-300",
  linkActive: "text-cyan-700 dark:text-cyan-300",
  /** 2px cyan bar on the active link, flush with the header's bottom border. */
  underline:
    "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-cyan-500 dark:after:bg-cyan-400",

  /** Mobile menu row (44px touch target). */
  row: "flex min-h-11 w-full items-center gap-2 rounded-lg px-4 text-base font-medium transition-colors duration-150 motion-reduce:transition-none",
  rowIdle:
    "text-slate-700 hover:bg-slate-100 hover:text-cyan-700 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-cyan-300",
  rowActive: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",

  iconButton:
    "flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60",
  /** Solid surfaces for popovers and the mobile menu panel. */
  popover:
    "border border-slate-200 bg-white text-slate-700 shadow-xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:shadow-black/40",
  panel: "bg-white dark:bg-slate-950",
  divider: "border-slate-200 dark:border-slate-800",
  textMuted: "text-slate-500 dark:text-slate-400",
} as const;
