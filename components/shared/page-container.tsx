import { cn } from "@/lib/cn";

type PageContainerProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Canonical page frame: one max width + responsive horizontal padding,
 * centered. Every page renders inside this (directly or via the shell) so
 * content never stretches edge-to-edge on very large monitors and the
 * topbar chrome stays aligned with the content below it.
 */
export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
