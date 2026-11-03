"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/cn";
import { Spinner } from "@/components/shared/spinner";

export function PendingSubmitButton({
  label,
  pendingLabel,
  variant = "primary",
  className,
  disabled = false,
  leadingIcon,
}: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary";
  className?: string;
  disabled?: boolean;
  leadingIcon?: ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary"
          ? "bg-primary text-white hover:bg-primary-600"
          : "border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800",
        className,
      )}
    >
      {pending && <Spinner />}
      {!pending && leadingIcon}
      {pending ? pendingLabel : label}
    </button>
  );
}
