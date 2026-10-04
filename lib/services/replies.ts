import "server-only";

import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";
import { joinSearchText } from "@/lib/search";
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

async function refreshCaseReplySearchText(caseId: string) {
  const replies = await SupportReplyModel.find({ caseId, deletedAt: null, isInternalNote: false })
    .select("body")
    .lean();
  const replyText = joinSearchText(replies.map((reply) => String(reply.body)));

  if (replyText) {
    await SupportCaseModel.findByIdAndUpdate(caseId, [
      {
        $set: {
          searchText: {
            $trim: {
              input: {
                $concat: ["$title", " ", "$question", " ", { $reduce: { input: "$tags", initialValue: "", in: { $concat: ["$$value", " ", "$$this"] } } }, " ", replyText],
              },
            },
          },
        },
      },
    ]);
  }
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

export async function editReply(replyId: string, body: string, actorId: string) {
  if (!mongoose.Types.ObjectId.isValid(replyId)) return null;
  await dbConnect();

  const reply = await SupportReplyModel.findOneAndUpdate(
    { _id: replyId, authorId: actorId, deletedAt: null },
    { body: body.trim(), editedAt: new Date() },
    { new: true, runValidators: true },
  ).lean();

  if (reply) await refreshCaseReplySearchText(String(reply.caseId));
  return reply ? toReplyListItem(reply) : null;
}

export async function softDeleteReply(replyId: string, actorId: string) {
  if (!mongoose.Types.ObjectId.isValid(replyId)) return null;
  await dbConnect();

  const reply = await SupportReplyModel.findOneAndUpdate(
    { _id: replyId, authorId: actorId, deletedAt: null },
    { deletedAt: new Date() },
    { new: true },
  ).lean();

  if (reply) await refreshCaseReplySearchText(String(reply.caseId));
  return reply ? toReplyListItem(reply) : null;
}

export async function getPublicReplies(caseId: string) {
  return listReplies(caseId, false);
}
