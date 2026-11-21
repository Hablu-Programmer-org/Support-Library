export type PageListItem = number | "gap";

/**
 * Page buttons for a numbered pager: first, last, and the current page with one
 * neighbour on each side. A hole of exactly one page shows that page instead of
 * a gap ("1 2 3", never "1 … 3"). Bad input degrades to a single page.
 *
 *   buildPageList(5, 12) → [1, "gap", 4, 5, 6, "gap", 12]
 *   buildPageList(1, 3)  → [1, 2, 3]
 */
export function buildPageList(page: number, totalPages: number): PageListItem[] {
  const total = Number.isFinite(totalPages) ? Math.max(1, Math.trunc(totalPages)) : 1;
  if (total === 1) return [1];
  const current = Number.isFinite(page) ? Math.min(Math.max(1, Math.trunc(page)), total) : 1;

  const pages = [...new Set([1, current - 1, current, current + 1, total])]
    .filter((item) => item >= 1 && item <= total)
    .sort((a, b) => a - b);

  const items: PageListItem[] = [];
  for (const item of pages) {
    const previous = items.at(-1);
    if (typeof previous === "number") {
      if (item - previous === 2) items.push(previous + 1);
      else if (item - previous > 2) items.push("gap");
    }
    items.push(item);
  }
  return items;
}
