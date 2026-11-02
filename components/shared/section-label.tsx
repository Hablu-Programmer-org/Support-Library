import type { ReactNode } from "react";

/**
 * A small section eyebrow.
 *
 * It stays an `h2` on purpose: the visual hierarchy got quieter, not the
 * document outline. Screen readers and the Playwright heading assertions still
 * find "The problem" and "Responses".
 */
export function SectionLabel({
  id,
  children,
}: {
  id?: string;
  children: ReactNode;
}) {
  return (
    <h2
      id={id}
      className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400"
    >
      {children}
    </h2>
  );
}
