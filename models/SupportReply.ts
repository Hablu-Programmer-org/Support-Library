import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { externalFileLinkSchema, videoLinkSchema } from "./shared";

const supportReplySchema = new mongoose.Schema(
  {
    issueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupportIssue",
      required: true,
      index: true,
    },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 20_000 },
    isInternalNote: { type: Boolean, default: false, index: true },
    fileLinks: { type: [externalFileLinkSchema], default: [] },
    videoLinks: { type: [videoLinkSchema], default: [] },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    collection: "support_replies",
  },
);

supportReplySchema.index({ issueId: 1, createdAt: 1 });

export type SupportReplyDocument = InferSchemaType<typeof supportReplySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SupportReplyModel: Model<SupportReplyDocument> =
  (mongoose.models.SupportReply as Model<SupportReplyDocument>) ??
  mongoose.model<SupportReplyDocument>("SupportReply", supportReplySchema);
