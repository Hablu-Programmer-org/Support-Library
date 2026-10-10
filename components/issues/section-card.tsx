"use client";

import { cn } from "@/lib/cn";

type SectionCardProps = {
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  description?: string;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  required?: boolean;
};

export function SectionCard({ title, children, icon, description, className, headerClassName, contentClassName, required }: SectionCardProps) {
  return (
    <section className={cn("rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900", className)}>
      <header className={cn("flex items-start gap-3 p-4 border-b border-slate-200 dark:border-slate-700", headerClassName)}>
        {icon && <span className="flex-shrink-0 mt-0.5 text-slate-500 dark:text-slate-400" aria-hidden="true">{icon}</span>}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
            {required && <span className="inline-flex items-center justify-center rounded-full bg-danger-100 px-2 py-0.5 text-xs font-medium text-danger-700 dark:bg-danger-950/50 dark:text-danger-200">Required</span>}
          </div>
          {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
      </header>
      <div className={cn("p-4", contentClassName)}>{children}</div>
    </section>
  );
}