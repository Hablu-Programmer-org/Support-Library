"use client";

import { useEffect, useState } from "react";

import {
  currentShift,
  supportHoursBn,
  supportScheduleBn,
  type LiveSupportConfig,
  type SupportPhase,
} from "@/lib/config/live-support";
import { cn } from "@/lib/cn";

type LiveSupportCardProps = {
  config: LiveSupportConfig;
};

const SHIFT_LABELS: Record<Exclude<SupportPhase, "off">, string> = {
  morning: "Morning shift",
  night: "Night shift",
};

const ORDER: Array<Exclude<SupportPhase, "off">> = ["morning", "night"];

/**
 * Join panel for the daily live support session.
 *
 * The phase starts as `null` and is resolved after mount: the schedule depends
 * on the viewer's clock, so rendering it during SSR would make the first client
 * render disagree with the server HTML whenever the two disagree about the
 * current shift. A one-frame "closed" state is cheaper than a hydration error.
 */
export function LiveSupportCard({ config }: LiveSupportCardProps) {
  const [phase, setPhase] = useState<SupportPhase | null>(null);

  useEffect(() => {
    const update = () => setPhase(currentShift(new Date()));
    update();

    const interval = setInterval(update, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const isOpen = phase !== null && phase !== "off";
  const joinLabel = `Live Support Center (${config.platform})`;
  const joinClass = cn(
    "inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950",
    isOpen
      ? "bg-primary text-white hover:bg-primary-600"
      : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  );
  const joinText = <>Join {config.platform} Meeting</>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {ORDER.map((shift) => (
          // Display-only chips (they carry no action), so they are inert:
          // `disabled` keeps them out of the tab order entirely.
          <button
            key={shift}
            type="button"
            aria-label={`${SHIFT_LABELS[shift]} button`}
            className={cn(
              "rounded-full px-6 py-2.5 text-sm font-semibold transition",
              phase === shift
                ? "bg-primary text-white"
                : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
            )}
            disabled
          >
            {SHIFT_LABELS[shift]}
          </button>
        ))}
      </div>

      <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
        {isOpen ? (
          <p className="font-medium text-success-700 dark:text-success-300">
            Live support is open right now.
          </p>
        ) : (
          <p className="font-medium text-danger-700 dark:text-danger-300">
            {phase === null
              ? "Checking support hours…"
              : "Live support is closed right now. Please join during a support slot."}
          </p>
        )}
        <p className="text-slate-500 dark:text-slate-400">
          Daily hours:{" "}
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {supportScheduleBn}
          </span>
        </p>
      </div>

      {isOpen ? (
        <a
          aria-disabled="false"
          aria-label={joinLabel}
          className={joinClass}
          href={config.joinUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          {joinText}
        </a>
      ) : (
        // Closed state drops the href on purpose: `pointer-events-none` only
        // stops the mouse, so a link left in the tab order would still open the
        // room when a keyboard user presses Enter. The explicit role keeps the
        // accessible role stable ("link") across both states.
        <span
          aria-disabled="true"
          aria-label={joinLabel}
          className={joinClass}
          role="link"
          tabIndex={-1}
        >
          {joinText}
        </span>
      )}

      <div className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        <div className="flex items-center justify-between gap-4 py-3">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Meeting ID
          </span>
          <span className="select-all text-sm font-semibold text-slate-900 dark:text-white">
            {config.meetingId}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Passcode
          </span>
          <span className="select-all text-sm font-semibold text-slate-900 dark:text-white">
            {config.passcode}
          </span>
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Before joining, try the course documentation and videos first — the team
        can help much faster when you share what you already tried. Total daily
        support time: {supportHoursBn()}.
      </p>
    </div>
  );
}
