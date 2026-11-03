import { z } from "zod";

import { linkLimit, videoLinkSchema } from "@/lib/validation";

const toHttpsUrl = (value: string) =>
  value.includes("://") ? value : `https://${value}`;

const hostLabel = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").slice(0, 120) || "Link";
  } catch {
    return "Link";
  }
};

const isValidTimestamp = (value: string) => {
  if (!/^\d+(?::\d+)*$/.test(value)) return false;
  const parts = value.split(":");
  if (parts.length > 3) return false;
  for (let i = 1; i < parts.length; i++) {
    const n = Number(parts[i]);
    if (!Number.isFinite(n) || n > 59) return false;
  }
  return true;
};

const normalizeSummary = (value?: string) => {
  if (!value) return undefined;
  return value.slice(0, 500) || undefined;
};

const normalizeTimestamp = (value?: string) => {
  if (!value) return undefined;
  if (value.length > 12) value = value.slice(0, 12);
  return isValidTimestamp(value) ? value : undefined;
};

const strictNormalizeSummary = (value?: string): string | null | undefined => {
  if (!value) return undefined;
  if (value.length > 500) return null;
  return value;
};

const strictNormalizeTimestamp = (value?: string): string | null | undefined => {
  if (!value) return undefined;
  if (value.length > 12) return null;
  return isValidTimestamp(value) ? value : null;
};

const splitLinkLines = (value?: string) =>
  value
    ?.split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("|").map((part) => part.trim())) ?? [];

export function parseVideoLinks(value?: string): z.infer<typeof videoLinkSchema>[] {
  const links: z.infer<typeof videoLinkSchema>[] = [];
  for (const parts of splitLinkLines(value)) {
    const url = toHttpsUrl(parts.length === 1 ? parts[0] : (parts[1] ?? ""));
    if (!url) continue;

    const title = parts.length === 1 ? hostLabel(url) : (parts[0] || hostLabel(url)).slice(0, 120);
    const rawTimestamp = parts.length === 1 ? undefined : parts[2];
    const timestamp = rawTimestamp ? normalizeTimestamp(rawTimestamp) : undefined;
    const rawSummary = parts.length === 1 ? undefined : parts[3];
    const summary = rawSummary ? normalizeSummary(rawSummary) : undefined;

    if (timestamp === null || summary === null) continue;

    const candidate = {
      title,
      url,
      timestamp,
      summary,
    };

    const parsed = videoLinkSchema.safeParse(candidate);
    if (parsed.success) links.push(parsed.data);
  }

  return links.slice(0, linkLimit());
}

export type StudentVideoLinksParseResult = {
  links: z.infer<typeof videoLinkSchema>[];
  invalidLines: string[];
  submittedLines: number;
  overflow: boolean;
};

export function parseStudentVideoLinksResult(value?: string): StudentVideoLinksParseResult {
  const lines = splitLinkLines(value);

  if (lines.length > 100) {
    return {
      links: [],
      invalidLines: lines.map((parts) => parts.join("|")),
      submittedLines: lines.length,
      overflow: true,
    };
  }

  const links: z.infer<typeof videoLinkSchema>[] = [];
  const invalidLines: string[] = [];

  for (const parts of lines) {
    if (parts.length > 4) {
      invalidLines.push(parts.join("|"));
      continue;
    }

    const url = toHttpsUrl(parts.length === 1 ? parts[0] : (parts[1] ?? ""));
    let parsedUrl: URL | null = null;
    try {
      parsedUrl = new URL(url);
    } catch {
      parsedUrl = null;
    }
    if (!parsedUrl || parsedUrl.protocol !== "https:") {
      invalidLines.push(parts.join("|"));
      continue;
    }

    const title = parts.length === 1 ? hostLabel(url) : (parts[0] || hostLabel(url));
    if (title.length > 120 || title.trim().length === 0) {
      invalidLines.push(parts.join("|"));
      continue;
    }

    const rawTimestamp = parts.length === 1 ? undefined : parts[2];
    const timestamp = rawTimestamp ? strictNormalizeTimestamp(rawTimestamp) : undefined;
    if (rawTimestamp && timestamp === null) {
      invalidLines.push(parts.join("|"));
      continue;
    }

    const rawSummary = parts.length === 1 ? undefined : parts[3];
    const summary = rawSummary ? strictNormalizeSummary(rawSummary) : undefined;
    if (rawSummary && summary === null) {
      invalidLines.push(parts.join("|"));
      continue;
    }

    const candidate = {
      title: title.trim(),
      url,
      timestamp,
      summary,
    };

    const parsed = videoLinkSchema.safeParse(candidate);
    if (parsed.success) links.push(parsed.data);
    else invalidLines.push(parts.join("|"));
  }

  const overflow = links.length > linkLimit();
  if (overflow) {
    return {
      links: [],
      invalidLines: lines.map((parts) => parts.join("|")),
      submittedLines: lines.length,
      overflow: true,
    };
  }

  return {
    links,
    invalidLines,
    submittedLines: lines.length,
    overflow: false,
  };
}

export function parseStudentVideoLinks(value?: string): z.infer<typeof videoLinkSchema>[] {
  const result = parseStudentVideoLinksResult(value);
  if (result.invalidLines.length > 0 || result.overflow) return [];
  return result.links;
}