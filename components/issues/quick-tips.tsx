"use client";

import { useEffect, useRef, useState } from "react";

import { HelpCircleIcon } from "@/components/icons";

/**
 * Info button that reveals a short list of tips in a popover.
 *
 * Kept as a client component because the surrounding page is a server component.
 * The panel is always rendered and toggled with `hidden` so `aria-controls` always
 * resolves to a real element; outside clicks and Escape close it.
 */
export function QuickTips({ tips }: { tips: string[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Quick tips"
        aria-expanded={open}
        aria-controls="quick-tips-panel"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-primary hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-primary dark:hover:text-primary-400"
      >
        <HelpCircleIcon size={18} />
      </button>

      <div
        id="quick-tips-panel"
        role="region"
        aria-label="Quick tips"
        hidden={!open}
        className="absolute right-0 top-full z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white p-4 text-left shadow-lg dark:border-slate-700 dark:bg-slate-900"
      >
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          Quick Tips
        </p>
        <ul className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-400">
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
