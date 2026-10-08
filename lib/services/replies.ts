import "server-only";

import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";
import { isAdmin, type UserRole } from "@/lib/roles";
import { buildCaseSearchTextWithReplies } from "@/lib/search";
import { supportReplyInputSchema, type SupportReplyInput } from "@/lib/validation";
import { SupportCaseModel, SupportReplyModel, UserModel } from "@/models";

type LeanDoc = Record<string, unknown>;

export type SupportReplyListItem = {
  id: string;
  caseId: string;
  authorId: string;
  authorName?: string;
  body: string;
  isInternalNote: boolean;
  fileLinks: Array<{ title: string; url: string; type?: string | null; note?: string | null }>;
  videoLinks: Array<{ title: string; url: string; timestamp?: string | null; summary?: string | null }>;
  createdAt?: Date;
  updatedAt?: Date;
  editedAt?: Date | null;
};

const toReplyListItem = (reply: LeanDoc, authors: Map<string, LeanDoc> = new Map()): SupportReplyListItem => {
  const authorId = String(reply.authorId);
  const author = authors.get(authorId);

  return {
    id: String(reply._id),
    caseId: String(reply.caseId),
    authorId,
    authorName: author?.name as string | undefined,
    body: String(reply.body),
    isInternalNote: reply.isInternalNote === true,
    fileLinks: Array.isArray(reply.fileLinks) ? reply.fileLinks as SupportReplyListItem["fileLinks"] : [],
    videoLinks: Array.isArray(reply.videoLinks) ? reply.videoLinks as SupportReplyListItem["videoLinks"] : [],
    createdAt: reply.createdAt as Date | undefined,
    updatedAt: reply.updatedAt as Date | undefined,
    editedAt: reply.editedAt as Date | null | undefined,
  };
};

async function buildAuthorMap(replies: LeanDoc[]) {
  const ids = [...new Set(replies.map((reply) => String(reply.authorId)).filter(Boolean))];
  if (!ids.length) return new Map<string, LeanDoc>();

  const authors = await UserModel.find({ _id: { $in: ids } }).select("name email").lean();
  return new Map(authors.map((author) => [String(author._id), author as LeanDoc]));
}

/**
 * Rebuilds a case's denormalized `searchText` from its own fields plus every
 * non-internal, non-deleted reply body.
 *
 * This recomputes from the case's fields instead of appending to the stored value
 * with an aggregation pipeline. The earlier pipeline concatenated only
 * `$title`/`$question`/`$tags`, which silently dropped
 * courseSlug/moduleSlug/contentSlug as soon as a reply existed, and left stale
 * reply text behind once the last public reply was removed.
 */
async function refreshCaseReplySearchText(caseId: string) {
  const [supportCase, replies] = await Promise.all([
    SupportCaseModel.findById(caseId).lean(),
    SupportReplyModel.find({ caseId, deletedAt: null, isInternalNote: false })
      .select("body")
      .lean(),
  ]);
  if (!supportCase) return;

  await SupportCaseModel.updateOne(
    { _id: caseId },
    {
      $set: {
        searchText: buildCaseSearchTextWithReplies(
          {
            title: supportCase.title,
            studentName: supportCase.studentName,
            studentEmail: supportCase.studentEmail,
            question: supportCase.question,
            courseSlug: supportCase.courseSlug,
            moduleSlug: supportCase.moduleSlug,
            contentSlug: supportCase.contentSlug,
            tags: supportCase.tags,
          },
          replies.map((reply) => reply.body),
        ),
      },
    },
  );
}

export async function addReply(input: SupportReplyInput, authorId: string) {
  const parsed = supportReplyInputSchema.parse(input);
  await dbConnect();

  const reply = await SupportReplyModel.create({
    ...parsed,
    authorId: new mongoose.Types.ObjectId(authorId),
  });

  await refreshCaseReplySearchText(parsed.caseId);
  return toReplyListItem(reply.toObject());
}

export async function listReplies(caseId: string, includeInternal = true) {
  if (!mongoose.Types.ObjectId.isValid(caseId)) return [];
  await dbConnect();

  const filter: Record<string, unknown> = { caseId, deletedAt: null };
  if (!includeInternal) filter.isInternalNote = false;

  const replies = await SupportReplyModel.find(filter).sort({ createdAt: 1 }).lean();
  const authors = await buildAuthorMap(replies as LeanDoc[]);
  return (replies as LeanDoc[]).map((reply) => toReplyListItem(reply, authors));
}

/**
 * Reply mutation is limited to the author, plus ADMIN as an override.
 *
 * Both edit and delete must use this, otherwise the UI shows a control that
 * silently does nothing for a mentor acting on someone else's reply.
 */
function replyMutationFilter(replyId: string, actorId: string, actorRole?: UserRole | null) {
  const base: Record<string, unknown> = { _id: replyId, deletedAt: null };
  if (isAdmin(actorRole ?? "VIEWER")) return base;
  return { ...base, authorId: actorId };
}

export async function editReply(
  replyId: string,
  body: string,
  actorId: string,
  actorRole?: UserRole | null,
) {
  if (!mongoose.Types.ObjectId.isValid(replyId)) return null;
  await dbConnect();

  const reply = await SupportReplyModel.findOneAndUpdate(
    replyMutationFilter(replyId, actorId, actorRole),
    { body: body.trim(), editedAt: new Date() },
    { new: true, runValidators: true },
  ).lean();

  if (reply) await refreshCaseReplySearchText(String(reply.caseId));
  return reply ? toReplyListItem(reply) : null;
}

export async function softDeleteReply(
  replyId: string,
  actorId: string,
  actorRole?: UserRole | null,
) {
  if (!mongoose.Types.ObjectId.isValid(replyId)) return null;
  await dbConnect();

  const reply = await SupportReplyModel.findOneAndUpdate(
    replyMutationFilter(replyId, actorId, actorRole),
    { deletedAt: new Date() },
    { new: true },
  ).lean();

  if (reply) await refreshCaseReplySearchText(String(reply.caseId));
  return reply ? toReplyListItem(reply) : null;
}

export async function getPublicReplies(caseId: string) {
  return listReplies(caseId, false);
}
