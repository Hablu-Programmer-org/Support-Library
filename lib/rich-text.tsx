import type { ReactNode } from "react";

type ParseOptions = {
  links?: boolean;
  depth?: number;
};

const MAX_DEPTH = 4;
const MAX_LINES = 2_000;

const linkClass =
  "text-primary underline underline-offset-2 wrap-break-word hover:text-primary-600";

const INLINE =
  /!\[([^\]]*)\]\(([^)\s]*)\)|\[([^\]]*)\]\(([^)\s]*)\)|`([^`\n]+)`|\*\*\*([^*\n]+)\*\*\*|\*\*([\s\S]+?)\*\*|~~([^~\n]+)~~|(?<!\w)\*([^*\n]+)\*(?!\w)|(?<!\w)_([^_\n]+)_(?!\w)|(https?:\/\/[^\s<>"'*\[\]]+)/g;

/** `null` for anything that is not an absolute HTTP(S) URL. */
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

const trimBareUrl = (raw: string) => {
  let url = raw.replace(/[.,;:!?'\"]+$/, "");
  while (
    url.endsWith(")") &&
    (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0)
  ) {
    url = url.slice(0, -1);
  }
  return url;
};

/**
 * Safe inline Markdown. It creates React nodes only: user input is never parsed
 * as HTML. `links: false` is used for text that already sits inside an anchor.
 */
export function parseRichText(
  text: string,
  options: ParseOptions = {},
): ReactNode[] {
  if (!text) return [];

  const allowLinks = options.links !== false;
  const depth = options.depth ?? 0;
  if (depth > MAX_DEPTH) return [text];

  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    const [raw, imageAlt, imageTarget, label, target, code, boldItalic, bold, strike, starItalic, underscoreItalic, bareUrl] = match;
    let node: ReactNode | null = null;
    let consumed = raw.length;

    if (imageAlt !== undefined) {
      if (!allowLinks) continue;
      const href = safeHref(imageTarget);
      if (!href) continue;
      node = (
        <a key={`image-${index}`} href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {`🖼 ${imageAlt.trim() || href}`}
        </a>
      );
    } else if (label !== undefined) {
      if (!allowLinks) continue;
      const href = safeHref(target);
      if (!href) continue;
      node = (
        <a key={`link-${index}`} href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {label.trim() ? parseRichText(label, { links: false, depth: depth + 1 }) : href}
        </a>
      );
    } else if (code !== undefined) {
      node = <code key={`code-${index}`} className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-primary-700 dark:bg-slate-800 dark:text-primary-300">{code}</code>;
    } else if (boldItalic !== undefined) {
      node = <strong key={`bold-italic-${index}`} className="font-semibold text-slate-900 dark:text-white"><em>{parseRichText(boldItalic, { links: allowLinks, depth: depth + 1 })}</em></strong>;
    } else if (bold !== undefined) {
      if (!bold.trim()) continue;
      node = <strong key={`bold-${index}`} className="font-semibold text-slate-900 dark:text-white">{parseRichText(bold, { links: allowLinks, depth: depth + 1 })}</strong>;
    } else if (strike !== undefined) {
      node = <del key={`strike-${index}`} className="text-slate-400 dark:text-slate-500">{parseRichText(strike, { links: allowLinks, depth: depth + 1 })}</del>;
    } else if (starItalic !== undefined || underscoreItalic !== undefined) {
      const content = starItalic ?? underscoreItalic;
      if (!content.trim()) continue;
      node = <em key={`italic-${index}`}>{parseRichText(content, { links: allowLinks, depth: depth + 1 })}</em>;
    } else if (bareUrl !== undefined) {
      if (!allowLinks) continue;
      const url = trimBareUrl(bareUrl);
      const href = safeHref(url);
      if (!href) continue;
      consumed = url.length;
      node = <a key={`url-${index}`} href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>{url}</a>;
    }

    if (node === null) continue;
    if (index > cursor) nodes.push(text.slice(cursor, index));
    nodes.push(node);
    cursor = index + consumed;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

const headingClasses = [
  "relative border-b border-slate-200 pb-2 text-[1.5em] font-bold tracking-tight text-slate-950 dark:border-slate-800 dark:text-white",
  "border-l-4 border-primary pl-3 text-[1.3em] font-semibold text-slate-950 dark:text-white",
  "text-[1.15em] font-semibold text-slate-950 dark:text-white",
  "text-[0.95em] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300",
  "text-[0.9em] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400",
  "text-[0.85em] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400",
];

const paragraph = (text: string, key: string | number) => (
  <p key={key} className="whitespace-pre-wrap leading-[1.75] text-slate-700 dark:text-slate-300">
    {parseRichText(text)}
  </p>
);

const splitTableRow = (line: string) =>
  line.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));

const tableDivider = (line: string) => {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
};

function renderBlocks(text: string): ReactNode[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").slice(0, MAX_LINES);
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    const fence = line.match(/^\s*```([^`]*)$/);
    if (fence) {
      const language = fence[1].trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) codeLines.push(lines[index++]);
      if (index < lines.length) index += 1;
      blocks.push(
        <div key={`fence-${index}`} className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
          {language ? <span className="absolute right-3 top-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{language}</span> : null}
          <pre className="overflow-x-auto p-4 font-mono text-[0.85em] leading-6 text-slate-700 dark:text-slate-300"><code>{codeLines.join("\n")}</code></pre>
        </div>,
      );
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const content = parseRichText(heading[2].replace(/\s+#+\s*$/, ""));
      const className = headingClasses[level - 1];
      if (level === 1) blocks.push(<h1 key={index} className={className}>{content}</h1>);
      else if (level === 2) blocks.push(<h2 key={index} className={className}>{content}</h2>);
      else if (level === 3) blocks.push(<h3 key={index} className={className}>{content}</h3>);
      else if (level === 4) blocks.push(<h4 key={index} className={className}>{content}</h4>);
      else if (level === 5) blocks.push(<h5 key={index} className={className}>{content}</h5>);
      else blocks.push(<h6 key={index} className={className}>{content}</h6>);
      index += 1;
      continue;
    }

    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push(<hr key={index} className="my-6 h-px border-0 bg-gradient-to-r from-transparent via-slate-300 to-transparent dark:via-slate-700" />);
      index += 1;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quoted: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) quoted.push(lines[index++].replace(/^\s*>\s?/, ""));
      blocks.push(<blockquote key={`quote-${index}`} className="space-y-3 rounded-r-lg border-l-4 border-primary-400 bg-primary-50/70 px-4 py-2.5 text-slate-600 dark:border-primary-500 dark:bg-primary-950/30 dark:text-slate-300">{renderBlocks(quoted.join("\n"))}</blockquote>);
      continue;
    }

    const listMatch = line.match(/^(\s*)([-+*]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[2]);
      const start = ordered ? Number.parseInt(listMatch[2], 10) : undefined;
      const items: ReactNode[] = [];
      while (index < lines.length) {
        const item = lines[index].match(/^(\s*)([-+*]|\d+\.)\s+(.+)$/);
        if (!item || /\d+\./.test(item[2]) !== ordered) break;
        const task = item[3].match(/^\[([ xX])\]\s+(.*)$/);
        items.push(
          <li key={index} className={task?.[1].toLowerCase() === "x" ? "text-slate-500 line-through dark:text-slate-500" : undefined}>
            {task ? <><span aria-hidden="true" className="mr-2 text-primary-500">{task[1].toLowerCase() === "x" ? "☑ " : "☐ "}</span>{parseRichText(task[2])}</> : parseRichText(item[3])}
          </li>,
        );
        index += 1;
      }
      const classes = ordered ? "list-decimal space-y-1.5 pl-6 marker:font-semibold marker:text-primary-600" : "list-disc space-y-1.5 pl-6 marker:text-primary-400";
      blocks.push(ordered ? <ol key={`list-${index}`} start={start} className={classes}>{items}</ol> : <ul key={`list-${index}`} className={classes}>{items}</ul>);
      continue;
    }

    if (line.includes("|") && index + 1 < lines.length && tableDivider(lines[index + 1])) {
      const headers = splitTableRow(line);
      const dividers = splitTableRow(lines[index + 1]);
      const align = dividers.map((cell) => cell.startsWith(":") && cell.endsWith(":") ? "center" : cell.endsWith(":") ? "right" : "left");
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) rows.push(splitTableRow(lines[index++]));
      blocks.push(
        <div key={`table-${index}`} className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full border-collapse text-left">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"><tr>{headers.map((cell, cellIndex) => <th key={cellIndex} style={{ textAlign: align[cellIndex] as "left" | "center" | "right" }} className="px-3 py-2 font-semibold">{parseRichText(cell)}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="even:bg-slate-50/60 dark:even:bg-slate-800/30">{headers.map((_, cellIndex) => <td key={cellIndex} style={{ textAlign: align[cellIndex] as "left" | "center" | "right" }} className="border-t border-slate-200 px-3 py-2 align-top dark:border-slate-800">{parseRichText(row[cellIndex] ?? "")}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (index < lines.length && lines[index].trim()) {
      if (/^(?:#{1,6}\s|\s*```|\s*>|\s*(?:[-+*]|\d+\.)\s+)/.test(lines[index])) break;
      if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(lines[index])) break;
      if (lines[index].includes("|") && index + 1 < lines.length && tableDivider(lines[index + 1])) break;
      paragraphLines.push(lines[index++]);
    }
    blocks.push(paragraph(paragraphLines.join("\n"), `paragraph-${index}`));
  }

  return blocks;
}

export function RichText({ text, className }: { text?: string | null; className?: string }) {
  return <div className={`space-y-3 wrap-break-word ${className ?? ""}`.trim()}>{renderBlocks(text ?? "")}</div>;
}
