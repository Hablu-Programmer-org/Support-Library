import { ISSUE_DETAILS_MAX, ISSUE_TITLE_CREATE_MAX } from "@/lib/constants";
import { withoutTemplateHeadings } from "@/lib/issue-template";

/**
 * Unsent "Create issue" drafts in localStorage, one per signed-in account.
 *
 * Browser storage is a convenience only: it may be missing, full or blocked
 * (private windows), so every access is guarded and a failure just means no
 * draft. Screenshots are never stored — files cannot be kept there.
 */

export const ISSUE_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type IssueDraftFields = {
  title: string;
  /** The editor's Markdown, template outline included. */
  question: string;
  courseSlug: string;
  moduleSlug: string;
  contentSlug: string;
  tags: string;
  videoLinks: string;
};

export type IssueDraft = IssueDraftFields & { savedAt: number };

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Per account, so a shared computer never shows one student another's draft. */
export function issueDraftKey(userId: string): string {
  return `support-library:issue-draft:v1:${userId}`;
}

const LIMITS: Record<keyof IssueDraftFields, number> = {
  title: ISSUE_TITLE_CREATE_MAX * 4,
  question: ISSUE_DETAILS_MAX * 2,
  courseSlug: 200,
  moduleSlug: 200,
  contentSlug: 200,
  tags: 1_000,
  videoLinks: 5_000,
};

const FIELDS = Object.keys(LIMITS) as Array<keyof IssueDraftFields>;

/** Nothing worth keeping: blank fields, or only the template outline. */
export function isEmptyIssueDraft(fields: IssueDraftFields): boolean {
  return FIELDS.every((field) =>
    field === "question" ? !withoutTemplateHeadings(fields.question).trim() : !fields[field].trim(),
  );
}

function storageOrNull(storage?: DraftStorage | null): DraftStorage | null {
  if (storage) return storage;
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // Access itself throws when site data is blocked.
  }
}

/**
 * The saved draft, or null. Anything malformed, oversized or older than a
 * week is treated as no draft (and removed when possible).
 */
export function readIssueDraft(key: string, now = Date.now(), storage?: DraftStorage | null): IssueDraft | null {
  const store = storageOrNull(storage);
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const draft = parseDraft(parsed);
    if (!draft || now - draft.savedAt > ISSUE_DRAFT_MAX_AGE_MS || draft.savedAt > now + 60_000 || isEmptyIssueDraft(draft)) {
      store.removeItem(key);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

function parseDraft(value: unknown): IssueDraft | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.savedAt !== "number" || !Number.isFinite(record.savedAt)) return null;
  const draft = { savedAt: record.savedAt } as IssueDraft;
  for (const field of FIELDS) {
    const fieldValue = record[field] ?? "";
    if (typeof fieldValue !== "string" || fieldValue.length > LIMITS[field]) return null;
    draft[field] = fieldValue;
  }
  return draft;
}

/** Save, or remove the key when there is nothing worth keeping. */
export function writeIssueDraft(
  key: string,
  fields: IssueDraftFields,
  now = Date.now(),
  storage?: DraftStorage | null,
): void {
  const store = storageOrNull(storage);
  if (!store) return;
  try {
    if (isEmptyIssueDraft(fields)) {
      store.removeItem(key);
      return;
    }
    const draft: IssueDraft = { ...pickFields(fields), savedAt: now };
    store.setItem(key, JSON.stringify(draft));
  } catch {
    // Quota exceeded or storage blocked: the form keeps working without a draft.
  }
}

export function clearIssueDraft(key: string, storage?: DraftStorage | null): void {
  const store = storageOrNull(storage);
  try {
    store?.removeItem(key);
  } catch {
    // Nothing to do.
  }
}

function pickFields(fields: IssueDraftFields): IssueDraftFields {
  return Object.fromEntries(FIELDS.map((field) => [field, fields[field]])) as IssueDraftFields;
}
