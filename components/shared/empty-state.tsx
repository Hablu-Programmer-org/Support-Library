type EmptyStateProps = {
  children: string;
};

export function EmptyState({ children }: EmptyStateProps) {
  return (
    <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">{children}</p>
  );
}
