import type { ReactNode } from "react";

type PageHeaderProps = {
  /** Rendered as the page <h1> — e2e tests assert these exact texts. */
  title: string;
  description?: string;
  /** Right-aligned action slot (e.g. a "create" button). */
  action?: ReactNode;
};

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && (
          <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
