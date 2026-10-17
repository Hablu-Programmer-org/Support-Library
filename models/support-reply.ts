import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { uploadAttachmentSchema, videoLinkSchema } from "./shared";

const supportReplySchema = new mongoose.Schema(
  {
    issueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "support-issue",
      required: true,
      index: true,
    },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 20_000 },
    videoLinks: { type: [videoLinkSchema], default: [] },
    uploads: { type: [uploadAttachmentSchema], default: [] },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null, index: true },
    createOperationId: { type: String, default: null },
    createOperationHash: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: "support-replies",
  },
);

supportReplySchema.index({ issueId: 1, createdAt: 1 });
supportReplySchema.index({ "uploads._id": 1 });
supportReplySchema.index(
  { authorId: 1, createOperationId: 1 },
  {
    unique: true,
    partialFilterExpression: { createOperationId: { $type: "string" } },
  },
);

export type SupportReplyDocument = InferSchemaType<typeof supportReplySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SupportReplyModel: Model<SupportReplyDocument> =
  (mongoose.models["support-reply"] as Model<SupportReplyDocument>) ??
  mongoose.model<SupportReplyDocument>("support-reply", supportReplySchema);
