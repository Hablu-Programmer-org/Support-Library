import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type PanelProps = {
  children: ReactNode;
  /** Remove body padding (for full-bleed list rows). */
  flush?: boolean;
  className?: string;
};

/**
 * The standard dashboard surface: slate-bordered card that matches the
 * topbar/sidebar palette in both themes.
 */
export function Panel({ children, flush, className }: PanelProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
        !flush && "p-4",
        className,
      )}
    >
      {children}
    </section>
  );
}
