import { z } from "zod";

import { externalFileLinkSchema, linkLimit, videoLinkSchema } from "@/lib/validation";

const toHttpsUrl = (value: string) =>
  value.includes("://") ? value : `https://${value}`;

const hostLabel = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").slice(0, 120) || "Link";
  } catch {
    return "Link";
  }
};

const normalizeType = (value?: string) => {
  if (!value) return undefined;
  return value.slice(0, 40) || undefined;
};

const normalizeNote = (value?: string) => {
  if (!value) return undefined;
  return value.slice(0, 300) || undefined;
};

const normalizeSummary = (value?: string) => {
  if (!value) return undefined;
  return value.slice(0, 500) || undefined;
};

const normalizeTimestamp = (value?: string) => {
  if (!value) return undefined;
  if (value.length > 12) value = value.slice(0, 12);
  return /^[\d:]+$/.test(value) ? value : undefined;
};

const splitLinkLines = (value?: string) =>
  value
    ?.split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("|").map((part) => part.trim())) ?? [];

export function parseFileLinks(value?: string): z.infer<typeof externalFileLinkSchema>[] {
  const links: z.infer<typeof externalFileLinkSchema>[] = [];

  for (const parts of splitLinkLines(value)) {
    const url = toHttpsUrl(parts.length === 1 ? parts[0] : (parts[1] ?? ""));
    if (!url) continue;

    const candidate = {
      title: parts.length === 1 ? hostLabel(url) : (parts[0] || hostLabel(url)).slice(0, 120),
      url,
      type: parts.length === 1 ? undefined : normalizeType(parts[2]),
      note: parts.length === 1 ? undefined : normalizeNote(parts[3]),
    };

    const parsed = externalFileLinkSchema.safeParse(candidate);
    if (parsed.success) links.push(parsed.data);
  }

  return links.slice(0, linkLimit());
}

export function parseVideoLinks(value?: string): z.infer<typeof videoLinkSchema>[] {
  const links: z.infer<typeof videoLinkSchema>[] = [];

  for (const parts of splitLinkLines(value)) {
    const url = toHttpsUrl(parts.length === 1 ? parts[0] : (parts[1] ?? ""));
    if (!url) continue;

    const candidate = {
      title: parts.length === 1 ? hostLabel(url) : (parts[0] || hostLabel(url)).slice(0, 120),
      url,
      timestamp: parts.length === 1 ? undefined : normalizeTimestamp(parts[2]),
      summary: parts.length === 1 ? undefined : normalizeSummary(parts[3]),
    };

    const parsed = videoLinkSchema.safeParse(candidate);
    if (parsed.success) links.push(parsed.data);
  }

  return links.slice(0, linkLimit());
}