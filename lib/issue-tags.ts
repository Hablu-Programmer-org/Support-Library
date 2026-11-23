/**
 * Tag hygiene for support issues.
 *
 * Tags are free text typed by staff, so the same idea arrives as "#AI",
 * "ai" and "aiagent." — and noise like "1" ends up as a browse chip. New tags
 * are normalized on save (`parseTagList`); the browse chips group what is
 * already stored by its normalized form and hide what nobody would browse.
 * Stored values are never rewritten here: a chip's href keeps the raw value so
 * the exact-match tag filter still finds those issues.
 */

/** Leading `#`/space and trailing punctuation (incl. the Bengali dari). */
const LEADING = /^[#\s]+/u;
const TRAILING = /[\s.,;:!?।|]+$/u;

export function normalizeTag(raw: string): string {
  return raw.normalize("NFC").replace(LEADING, "").replace(TRAILING, "").toLowerCase();
}

/** Comma-separated form input → normalized, de-duplicated tags. */
export function parseTagList(value?: string): string[] {
  if (!value) return [];
  return [...new Set(value.split(",").map(normalizeTag).filter(Boolean))];
}

/**
 * Migration planner for a stored `tags` array (see
 * `scripts/normalize-issue-tags.ts`). Non-string entries and tags that
 * normalize to nothing are dropped; order of first appearance is kept.
 */
export function planTagNormalization(stored: unknown): {
  next: string[];
  changed: boolean;
  dropped: number;
} {
  const before = Array.isArray(stored) ? stored : [];
  const next: string[] = [];
  let dropped = 0;
  for (const value of before) {
    const tag = typeof value === "string" ? normalizeTag(value) : "";
    if (!tag || next.includes(tag)) {
      dropped += 1;
      continue;
    }
    next.push(tag);
  }
  const changed =
    !Array.isArray(stored) ||
    next.length !== before.length ||
    next.some((tag, index) => tag !== before[index]);
  return { next, changed, dropped };
}

/** Worth offering as a browse chip: not a lone character or a bare number. */
export function isBrowsableTag(tag: string): boolean {
  const normalized = normalizeTag(tag);
  return normalized.length >= 2 && !/^\d+$/u.test(normalized);
}

/** Browse chips shown above the list; more than this turns into noise. */
export const BROWSE_TAG_LIMIT = 8;

export type TagCount = { tag: string; count: number };
/** `tag` is the stored value (for the filter href); `label` is what is shown. */
export type PopularTag = { tag: string; label: string; count: number };

/**
 * Most-used browsable tags, with variants of one tag merged under its
 * normalized label. The href uses the variant most issues carry.
 */
export function popularTags(rows: TagCount[], limit: number): PopularTag[] {
  const groups = new Map<string, { best: TagCount; count: number }>();
  for (const row of rows) {
    if (!isBrowsableTag(row.tag)) continue;
    const label = normalizeTag(row.tag);
    const group = groups.get(label);
    if (!group) {
      groups.set(label, { best: row, count: row.count });
      continue;
    }
    group.count += row.count;
    if (row.count > group.best.count) group.best = row;
  }

  return [...groups.entries()]
    .map(([label, { best, count }]) => ({ tag: best.tag, label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}
