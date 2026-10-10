"use client";

import { forwardRef, useState, useRef } from "react";
import { motion } from "framer-motion";
import { ChevronDownIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

type AccordionProps = {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  contentClassName?: string;
};

export const Accordion = forwardRef<HTMLDetailsElement, AccordionProps>(
  ({ title, children, defaultOpen = false, icon, className, titleClassName, contentClassName }, ref) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const contentRef = useRef<HTMLDivElement>(null);

    const toggle = () => setIsOpen((prev) => !prev);

    return (
      <details ref={ref} className={cn("group rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900", className)} open={isOpen}>
        <summary
          className={cn(
            "flex items-center gap-3 p-4 cursor-pointer list-none select-none transition-colors",
            "hover:bg-slate-50 dark:hover:bg-slate-800/50",
            titleClassName
          )}
          onClick={(e) => {
            e.preventDefault();
            toggle();
          }}
        >
          {icon && <span className="flex-shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true">{icon}</span>}
          <span className="font-semibold text-slate-900 dark:text-white flex-1">{title}</span>
          <motion.div
            className="flex-shrink-0 text-slate-400 transition-transform duration-200"
            animate={{ rotate: isOpen ? 180 : 0 }}
            style={{ transformOrigin: "center" }}
          >
            <ChevronDownIcon size={18} />
          </motion.div>
        </summary>

        <div ref={contentRef} hidden={!isOpen} className={cn("overflow-hidden", contentClassName)}>
          <div className="px-4 pb-4 pt-0">{children}</div>
        </div>
      </details>
    );
  }
);

Accordion.displayName = "Accordion";
