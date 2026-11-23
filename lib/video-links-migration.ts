/**
 * Pure planner for `scripts/remove-video-links.ts`.
 *
 * The separate "Video links" field was retired once every add/edit surface moved
 * to the rich-text editor (which has its own Link tool). Existing links are kept
 * by appending them to the issue `question` / reply `body` as a Markdown list that
 * `lib/rich-text` renders as clickable links.
 */

/** `maxlength` of `SupportIssue.question` and `SupportReply.body`. */
export const VIDEO_LINKS_TEXT_MAX = 20_000;

export const VIDEO_LINKS_HEADING = "**Video links**";

type LegacyVideoLink = {
  title?: unknown;
  url?: unknown;
  timestamp?: unknown;
  summary?: unknown;
};

const oneLine = (value: unknown): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

const httpUrl = (value: unknown): string | null => {
  const raw = oneLine(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
};

/**
 * One list line. RichText's link pattern is `[label](url)` with no `]` in the
 * label and no `)` or whitespace in the URL, so square brackets in the title are
 * softened to parentheses and a URL containing `)` is written bare (RichText
 * auto-links bare URLs).
 */
export function formatVideoLinkLine(link: LegacyVideoLink): string | null {
  const url = httpUrl(link.url);
  if (!url) return null;
  const title = oneLine(link.title).replace(/\[/g, "(").replace(/\]/g, ")");
  const head = title && !url.includes(")") ? `[${title}](${url})` : title ? `${title}: ${url}` : url;
  const details = [oneLine(link.timestamp), oneLine(link.summary)].filter(Boolean).join(" · ");
  return `- ${head}${details ? ` — ${details}` : ""}`;
}

export type VideoLinksFoldPlan =
  | { kind: "unset-only"; droppedLinks: number }
  | { kind: "fold"; text: string; appended: string; links: number; droppedLinks: number }
  | { kind: "too-long"; length: number; links: number };

/** Decide what to write for one document; never mutates its input. */
export function planVideoLinksFold(
  text: unknown,
  videoLinks: unknown,
  max = VIDEO_LINKS_TEXT_MAX,
): VideoLinksFoldPlan {
  const links = Array.isArray(videoLinks) ? (videoLinks as LegacyVideoLink[]) : [];
  const lines = links.map((link) => formatVideoLinkLine(link ?? {})).filter((line): line is string => Boolean(line));
  const droppedLinks = links.length - lines.length;
  if (!lines.length) return { kind: "unset-only", droppedLinks };

  const base = typeof text === "string" ? text.trimEnd() : "";
  const appended = `${VIDEO_LINKS_HEADING}\n\n${lines.join("\n")}`;
  const next = base ? `${base}\n\n${appended}` : appended;
  if (next.length > max) return { kind: "too-long", length: next.length, links: lines.length };
  return { kind: "fold", text: next, appended, links: lines.length, droppedLinks };
}
