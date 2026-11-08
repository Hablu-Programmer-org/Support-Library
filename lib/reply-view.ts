import type { SupportReplyListItem } from "@/lib/services/replies";

/**
 * Who is reading a reply thread.
 *
 * - `staff` — full view (internal queue and case page for ADMIN/MENTOR);
 * - `owner` — the student who created the case: the team's answers plus their
 *   own follow-ups, never another student's reply;
 * - `public` — a PUBLISHED case in the Student Library, read by any signed-in
 *   student. The team reviewed the whole thread before publishing it (any edit
 *   or new reply forces a re-review), so every reply is shown — but without the
 *   author's identity.
 */
export type ReplyViewer = "staff" | "owner" | "public";

/**
 * Drops the rows and identity fields a viewer may not see.
 *
 * Kept pure so the whole matrix is unit-testable without a database. Note that
 * `isStaffReply` is kept: the UI uses it for the "Staff" label, and it is not an
 * identity by itself.
 */
export function projectRepliesForViewer(
  replies: SupportReplyListItem[],
  viewer: ReplyViewer,
  viewerId?: string,
): SupportReplyListItem[] {
  if (viewer === "staff") return replies;

  return replies.flatMap((reply) => {
    const isOwnReply = Boolean(viewerId && reply.authorId === viewerId);

    // The owner sees the team's answers and their own follow-ups. A public view
    // is a reviewed case, so every reply on it is shown.
    if (viewer === "owner" && !reply.isStaffReply && !isOwnReply) return [];

    return [
      {
        ...reply,
        // Author ids are internal in every student-facing view.
        authorId: "",
        // Staff names survive only for the owner (the page already labels them
        // "Support team"). The library never receives a name, so a student's
        // identity cannot travel with their reply.
        authorName: viewer === "owner" ? reply.authorName : undefined,
      },
    ];
  });
}
