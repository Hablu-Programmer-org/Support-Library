/**
 * Who may read one uploaded image through `/api/attachments/<id>`.
 *
 * Four identities pass:
 *
 * - **staff** (ADMIN/MENTOR) — they review every case;
 * - **the uploader** — a student always keeps access to what they submitted;
 * - **the owner of the case** — so a student can open the screenshots the team
 *   attached to *their own* request, not just the ones they uploaded;
 * - **anyone, once the case is PUBLISHED** — the Student Library shows the
 *   reviewed evidence and answer images to every signed-in student.
 *
 * Everything else must be answered with 404 (never 403) so the endpoint cannot
 * be used as an existence oracle for someone else's attachment. The caller
 * already re-reads the parent case on every request, so unpublishing or editing
 * the case revokes this access immediately.
 *
 * Pure and dependency-free so the whole authorization matrix can be unit-tested
 * without a database (same pattern as `lib/issue-ownership.ts`).
 */
export type AttachmentAccessInput = {
  viewerId: string;
  isStaff: boolean;
  /** `uploads[].uploadedBy` of the file itself. */
  uploaderId: string;
  /** `SupportIssue.createdBy` of the case that owns the file. */
  ownerId: string;
  parentVisibility: "PUBLISHED" | "INTERNAL";
};

export function canDownloadAttachment(input: AttachmentAccessInput): boolean {
  if (input.isStaff) return true;
  if (input.uploaderId && input.uploaderId === input.viewerId) return true;
  if (input.ownerId && input.ownerId === input.viewerId) return true;
  return input.parentVisibility === "PUBLISHED";
}
