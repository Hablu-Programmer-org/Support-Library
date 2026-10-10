"use client";

import { cn } from "@/lib/cn";

type StickyActionBarProps = {
  children: React.ReactNode;
  className?: string;
  loading?: boolean;
  loadingText?: string;
};

export function StickyActionBar({
  children,
  className,
  loading = false,
  loadingText = "Creating...",
}: StickyActionBarProps) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 flex items-center justify-end gap-3 p-4 bg-white/95 backdrop-blur-sm dark:bg-slate-950/95 md:static md:bg-transparent md:p-0 md:backdrop-none",
        className,
      )}
      aria-live="polite"
    >
      <div className="w-full md:max-w-lg md:mx-auto">{children}</div>
      {loading && (
        <div
          className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"
          role="status"
          aria-live="polite"
        >
          <svg
            className="animate-spin h-4 w-4 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span>{loadingText}</span>
        </div>
      )}
    </div>
  );
}
