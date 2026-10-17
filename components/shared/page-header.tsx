import type { ReactNode } from "react";

type PageHeaderProps = {
  /** Rendered as the page <h1> — e2e tests assert these exact texts. */
  title: string;
  description?: string;
  /** Right-aligned action slot (e.g. a "create" button). */
  action?: ReactNode;
  /** Optional row rendered above the title (badges, status chips). */
  meta?: ReactNode;
};

export function PageHeader({ title, description, action, meta }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        {meta && <div className="mb-2 flex flex-wrap items-center gap-2">{meta}</div>}
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
