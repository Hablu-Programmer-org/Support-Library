type FormattableVideoLink = {
  title: string;
  url: string;
  timestamp?: string | null;
  summary?: string | null;
};

/**
 * Renders stored video links back into the one-per-line format the forms accept.
 *
 * Used by the issue edit form and the reply edit form, so a round trip through
 * the textarea never loses or reorders fields. Trailing empty fields are dropped
 * so a link that only has a title and URL does not come back as `title|url||`.
 *
 * No dependencies on purpose: both call sites are client components, and pulling
 * the Zod validation module in for a string join would bloat their bundle.
 */
export function formatVideoLinks(links?: FormattableVideoLink[] | null): string {
  return (links ?? [])
    .map((link) => {
      const parts = [link.title, link.url, link.timestamp ?? "", link.summary ?? ""];
      while (parts.length > 2 && !parts[parts.length - 1]) parts.pop();
      return parts.join("|");
    })
    .join("\n");
}
