import type { ReactNode } from "react";

/**
 * Minimal inline formatting for support replies: `**bold**`, `[label](https://url)`
 * and bare `https://` links.
 *
 * Everything is rendered as React nodes, never HTML, so a reply containing
 * `<script>` still shows it literally and the CSP needs no change. Links are
 * only emitted for absolute http(s) URLs — `javascript:`, `data:` or a relative
 * path stays as typed text.
 *
 * A pair that wraps nothing but whitespace (`** **`) is not bold, and an
 * unclosed `**` is left alone. `links: false` keeps link syntax literal, which
 * is what a video-link title needs because it already sits inside an anchor.
 */
type ParseOptions = {
  links?: boolean;
  depth?: number;
};

const MAX_DEPTH = 2;

const linkClass =
  "text-primary underline underline-offset-2 wrap-break-word hover:text-primary-600";

const INLINE =
  /\[([^\]]*)\]\(([^)\s]*)\)|\*\*([\s\S]+?)\*\*|(https?:\/\/[^\s<>"'*[\]]+)/g;

/** `null` for anything that is not an absolute http(s) URL. */
const safeHref = (value: string) => {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

/** Trailing sentence punctuation belongs to the sentence, not the URL. */
const trimBareUrl = (raw: string) => {
  let url = raw.replace(/[.,;:!?'"]+$/, "");

  // "(see https://example.com/a)" — drop the closing paren that opened the
  // sentence, but keep balanced ones that are part of the path.
  while (
    url.endsWith(")") &&
    (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0)
  ) {
    url = url.slice(0, -1);
  }

  return url;
};

export function parseRichText(
  text: string,
  options: ParseOptions = {},
): ReactNode[] {
  if (!text) return [];

  const allowLinks = options.links !== false;
  const depth = options.depth ?? 0;
  // Recursion only goes bold -> link label (and back), so a couple of levels is
  // plenty; the guard keeps hostile input from nesting the render tree.
  if (depth > MAX_DEPTH) return [text];

  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    const [raw, label, target, boldContent, bareUrl] = match;

    if (label !== undefined) {
      if (!allowLinks) continue;
      const href = safeHref(target);
      if (!href) continue;

      const content = label.trim()
        ? parseRichText(label, { links: false, depth: depth + 1 })
        : href;

      if (index > cursor) nodes.push(text.slice(cursor, index));
      nodes.push(
        <a
          key={`link-${index}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          {content}
        </a>,
      );
      cursor = index + raw.length;
      continue;
    }

    if (boldContent !== undefined) {
      if (!boldContent.trim()) continue;

      if (index > cursor) nodes.push(text.slice(cursor, index));
      nodes.push(
        <strong key={`bold-${index}`}>
          {parseRichText(boldContent, { links: allowLinks, depth: depth + 1 })}
        </strong>,
      );
      cursor = index + raw.length;
      continue;
    }

    if (bareUrl !== undefined) {
      if (!allowLinks) continue;

      const url = trimBareUrl(bareUrl);
      const href = safeHref(url);
      if (!href) continue;

      if (index > cursor) nodes.push(text.slice(cursor, index));
      nodes.push(
        <a
          key={`url-${index}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          {url}
        </a>,
      );
      cursor = index + url.length;
    }
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));

  return nodes;
}

export function RichText({
  text,
  className,
}: {
  text?: string | null;
  className?: string;
}) {
  return <p className={className}>{parseRichText(text ?? "")}</p>;
}
