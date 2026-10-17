import "server-only";

import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";
import { assertOperationPayload } from "@/lib/mutation-security";
import { discardUploads } from "@/lib/uploads/ingest";
import { SupportIssueModel, SupportReplyModel } from "@/models";

type LeanDoc = Record<string, unknown>;

/**
 * Public view of one uploaded image.
 *
 * The storage `key` is deliberately absent: the only handle the client needs is
 * the id, which `/api/attachments/[id]` resolves and authorizes.
 */
export type AttachmentView = {
  id: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  uploadedBy: string;
  createdAt?: Date;
};

export const toAttachmentView = (upload: LeanDoc): AttachmentView => ({
  id: String(upload._id),
  originalName: String(upload.originalName ?? "image"),
  mimeType: String(upload.mimeType ?? "application/octet-stream"),
  byteSize: Number(upload.byteSize ?? 0),
  width: (upload.width as number | null | undefined) ?? null,
  height: (upload.height as number | null | undefined) ?? null,
  uploadedBy: String(upload.uploadedBy ?? ""),
  createdAt: upload.createdAt as Date | undefined,
});

/** Maps a raw `uploads` array out of a lean document into safe views. */
export const toAttachmentViews = (value: unknown): AttachmentView[] =>
  Array.isArray(value) ? (value as LeanDoc[]).map(toAttachmentView) : [];

/** Everything the download route needs to authorize and stream one object. */
export type AttachmentDownload = {
  id: string;
  key: string;
  mimeType: string;
  originalName: string;
  byteSize: number;
  uploadedBy: string;
  parentType: "SupportIssue" | "SupportReply";
  parentId: string;
};

/**
 * Resolves an attachment id to its owning document and stored object.
 *
 * Issues are checked first, then replies. Both lookups are exact matches on the
 * indexed `uploads._id`, so an unknown id costs two indexed misses and returns
 * `null` — the caller must answer 404, never 403, so the endpoint cannot be used
 * as an existence oracle for someone else's attachments.
 */
export async function findAttachmentForDownload(
  attachmentId: string,
): Promise<AttachmentDownload | null> {
  if (!mongoose.Types.ObjectId.isValid(attachmentId)) return null;
  await dbConnect();

  const [issue, reply] = await Promise.all([
    SupportIssueModel.findOne({ "uploads._id": attachmentId }).select("uploads").lean(),
    SupportReplyModel.findOne({ "uploads._id": attachmentId }).select("uploads").lean(),
  ]);

  const parent = issue
    ? { parentType: "SupportIssue" as const, parentId: String(issue._id), uploads: issue.uploads }
    : reply
      ? { parentType: "SupportReply" as const, parentId: String(reply._id), uploads: reply.uploads }
      : null;
  if (!parent) return null;

  const upload = ((parent.uploads ?? []) as unknown as LeanDoc[]).find(
    (entry) => String(entry._id) === attachmentId,
  );
  if (!upload) return null;

  return {
    id: attachmentId,
    key: String(upload.key),
    mimeType: String(upload.mimeType ?? "application/octet-stream"),
    originalName: String(upload.originalName ?? "image"),
    byteSize: Number(upload.byteSize ?? 0),
    uploadedBy: String(upload.uploadedBy ?? ""),
    parentType: parent.parentType,
    parentId: parent.parentId,
  };
}

/**
 * Deletes the stored objects of `uploads` that `referenced` does not already
 * point at.
 *
 * A replayed operation id (or a lost duplicate-key race) means the objects this
 * attempt wrote are dead weight — but the same array can also be the one the
 * stored document references, and deleting those would break a live attachment.
 * Comparing keys keeps both cases correct.
 */
export async function discardUnreferencedUploads(
  uploads: readonly { key: string }[],
  referenced: unknown,
): Promise<void> {
  if (!uploads.length) return;
  const usedKeys = new Set(
    ((Array.isArray(referenced) ? referenced : []) as LeanDoc[]).map((entry) => String(entry.key)),
  );
  await discardUploads(uploads.filter((upload) => !usedKeys.has(upload.key)));
}

/**
 * Finishes a replayed operation id without leaking object storage.
 *
 * A replay must never leave the objects written by this attempt behind:
 *
 * - hash matches — the stored document is the answer, so only the objects it does
 *   not already reference are removed (`discardUnreferencedUploads`, which is a
 *   no-op for freshly generated keys but stays correct if the same array were
 *   ever replayed);
 * - hash differs (or the stored row predates hashing and has none) — the retry
 *   reused an operation id with a different payload, so *everything* from this
 *   attempt is deleted before the conflict is reported.
 *
 * The mismatch path deletes before calling `assertOperationPayload`, because that
 * function throws and would otherwise skip the cleanup.
 */
export async function settleReplayedUploads(
  uploads: readonly { key: string }[],
  storedHash: string | null | undefined,
  requestHash: string,
  referenced: unknown,
): Promise<void> {
  if (storedHash === requestHash) {
    await discardUnreferencedUploads(uploads, referenced);
    return;
  }
  await discardUploads(uploads);
  assertOperationPayload(storedHash, requestHash);
}
