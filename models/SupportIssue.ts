import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { CASE_PRIORITIES, CASE_STATUSES } from "./shared";

const supportIssueSchema = new mongoose.Schema(
  {
    studentName: { type: String, required: true, trim: true, maxlength: 120 },
    studentEmail: { type: String, required: true, lowercase: true, trim: true, maxlength: 160 },
    lmsUserId: { type: String, default: null },
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
    collection: "support_issues",
  },
);

supportIssueSchema.index({ courseSlug: 1, batchNo: 1, status: 1 });
supportIssueSchema.index({ createdAt: -1 });
supportIssueSchema.index({ deletedAt: 1 }, { partialFilterExpression: { deletedAt: { $exists: true } } });

export type SupportIssueDocument = InferSchemaType<typeof supportIssueSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SupportIssueModel: Model<SupportIssueDocument> =
  (mongoose.models.SupportIssue as Model<SupportIssueDocument>) ??
  mongoose.model<SupportIssueDocument>("SupportIssue", supportIssueSchema);