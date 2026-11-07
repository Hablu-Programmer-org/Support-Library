import "server-only";

import mongoose, { type ClientSession } from "mongoose";

import {
  buildSearchFieldUpdate,
  type SearchIndexIssueSource,
  type SearchIndexReplySource,
} from "@/lib/search-index-build";
import { SupportIssueModel, SupportReplyModel, UserModel } from "@/models";

export { buildSearchFieldUpdate } from "@/lib/search-index-build";
export type {
  SearchFieldUpdate,
  SearchIndexIssueSource,
  SearchIndexReplySource,
} from "@/lib/search-index-build";

type ReplyLike = {
  authorId?: unknown;
  [key: string]: unknown;
};

/** Loads the author roles needed for the legacy `isStaffReply` fallback. */
export async function loadAuthorRoles(
  replies: readonly ReplyLike[],
  session?: ClientSession | null,
) {
  const ids = [...new Set(replies.map((reply) => String(reply.authorId ?? "")).filter(Boolean))];
  if (ids.length === 0) return new Map<string, string>();

  const query = UserModel.find({
    _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
  }).select("role");
  if (session) query.session(session);
  const users = await query.lean();

  return new Map(users.map((user) => [String(user._id), String(user.role ?? "")]));
}

/**
 * Rebuilds both denormalized text fields from the stored issue and its live
 * replies.
 *
 * Always computed from source documents — never appended — so an edit can only
 * produce the current text, and a removed reply can only disappear.
 *
 * `touchUpdatedAt` defaults to true, matching the write paths this replaces:
 * `updatedAt` drives the default list order and the optimistic revision, so
 * changing that behaviour would be a silent UX regression. Callers that already
 * bumped the issue pass `false`; the backfill uses `timestamps: false` instead.
 */
export async function rebuildIssueSearchFields(
  issueId: string,
  session?: ClientSession | null,
  options: { touchUpdatedAt?: boolean } = {},
) {
  if (!mongoose.Types.ObjectId.isValid(issueId)) return null;

  const issueQuery = SupportIssueModel.findById(issueId).select(
    "title question studentName batchNo courseSlug moduleSlug contentSlug tags videoLinks uploads",
  );
  const repliesQuery = SupportReplyModel.find({ issueId, deletedAt: null }).select(
    "body isStaffReply authorId videoLinks uploads",
  );
  if (session) {
    issueQuery.session(session);
    repliesQuery.session(session);
  }

  const [issue, replies] = await Promise.all([issueQuery.lean(), repliesQuery.lean()]);
  if (!issue) return null;

  const roleById = await loadAuthorRoles(replies as ReplyLike[], session);
  const update = buildSearchFieldUpdate(
    issue as SearchIndexIssueSource,
    replies as SearchIndexReplySource[],
    roleById,
  );

  const updateQuery = SupportIssueModel.updateOne(
    { _id: issueId },
    { $set: update },
    { timestamps: options.touchUpdatedAt ?? true },
  );
  if (session) updateQuery.session(session);

  await updateQuery;

  return update;
}
