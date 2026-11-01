import type { ReactNode } from "react";

/**
 * Minimal inline formatting for support replies.
 *
 * Only `**bold**` is supported on purpose: the reply body is plain text written
 * by staff and students, and the app renders it with React nodes instead of
 * HTML. Nothing here can inject markup — every plain run is a text node, so a
 * reply containing `<script>` or `<b>` still shows those characters literally
 * and the CSP needs no change.
 *
 * A pair that wraps nothing but whitespace (`** **`) is not bold; the markers
 * stay as typed. An unclosed `**` is likewise left alone.
 */
export function parseRichText(text: string): ReactNode[] {
  if (!text) return [];

  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(/\*\*([\s\S]+?)\*\*/g)) {
    const content = match[1];
    // `** **` is not a bold pair, so leave the whole run as plain text.
    if (!content.trim()) continue;

    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    nodes.push(<strong key={`bold-${match.index}`}>{content}</strong>);
    cursor = match.index + match[0].length;
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
