import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { CASE_PRIORITIES, CASE_STATUSES } from "./shared";

const supportCaseSchema = new mongoose.Schema(
  {
    studentRefId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudentRef",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 200 },
    question: { type: String, required: true, trim: true, minlength: 5, maxlength: 20_000 },
    courseSlug: { type: String, trim: true, default: null, index: true },
    batchNo: { type: Number, default: null, index: true },
    moduleSlug: { type: String, trim: true, default: null },
    contentSlug: { type: String, trim: true, default: null },
    status: { type: String, enum: CASE_STATUSES, default: "OPEN", index: true },
    priority: { type: String, enum: CASE_PRIORITIES, default: "NORMAL", index: true },
    tags: { type: [String], default: [], index: true },
    mentorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    searchText: { type: String, required: true, trim: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    collection: "support_cases",
  },
);

supportCaseSchema.index({ courseSlug: 1, batchNo: 1, status: 1 });
supportCaseSchema.index({ createdAt: -1 });
supportCaseSchema.index({ deletedAt: 1 }, { partialFilterExpression: { deletedAt: { $exists: true } } });

export type SupportCaseDocument = InferSchemaType<typeof supportCaseSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SupportCaseModel: Model<SupportCaseDocument> =
  (mongoose.models.SupportCase as Model<SupportCaseDocument>) ??
  mongoose.model<SupportCaseDocument>("SupportCase", supportCaseSchema);
