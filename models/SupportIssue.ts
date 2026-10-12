import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { CASE_PRIORITIES, CASE_STATUSES, ISSUE_VISIBILITIES } from "./shared";

const publicationEventSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["PUBLISHED", "UNPUBLISHED", "CONTENT_CHANGED", "PUBLIC_REPLY_CHANGED", "ARCHIVED"],
      required: true,
    },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const supportIssueSchema = new mongoose.Schema(
  {
    studentName: { type: String, required: true, trim: true, maxlength: 120 },
    // Legacy fields remain readable only until the guarded migration removes them.
    studentEmail: { type: String, select: false },
    studentEmailHash: { type: String, select: false },
    studentEmailEncrypted: {
      ciphertext: { type: String, required: true },
      iv: { type: String, required: true },
      authTag: { type: String, required: true },
      keyVersion: { type: String, required: true },
    },
    studentEmailLookup: {
      digest: { type: String, required: true },
      keyVersion: { type: String, required: true },
    },
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
    visibility: {
      type: String,
      enum: ISSUE_VISIBILITIES,
      default: "INTERNAL",
      index: true,
    },
    publishedAt: { type: Date, default: null },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    publicationHistory: { type: [publicationEventSchema], default: [] },
    mentorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    searchText: { type: String, required: true, trim: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    createOperationId: { type: String, default: null },
    createOperationHash: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: "support_issues",
  },
);

supportIssueSchema.index({ courseSlug: 1, batchNo: 1, status: 1 });
supportIssueSchema.index({ visibility: 1, updatedAt: -1 });
supportIssueSchema.index({ createdAt: -1 });
supportIssueSchema.index(
  { "studentEmailLookup.keyVersion": 1, "studentEmailLookup.digest": 1 },
  { name: "student_email_lookup" },
);
supportIssueSchema.index(
  { deletedAt: 1 },
  { name: "deletedAt_date_partial", partialFilterExpression: { deletedAt: { $type: "date" } } },
);
supportIssueSchema.index(
  { createdBy: 1, createOperationId: 1 },
  {
    unique: true,
    // MongoDB partial filter expressions restrict operators to $eq/$gt/$gte/$lt/$lte/
    // $type/$exists/$and/$or; $ne is rejected. Documents without an operation id
    // (null) are therefore excluded rather than colliding on a placeholder value.
    partialFilterExpression: { createOperationId: { $type: "string" } },
  },
);

export type SupportIssueDocument = InferSchemaType<typeof supportIssueSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SupportIssueModel: Model<SupportIssueDocument> =
  (mongoose.models.SupportIssue as Model<SupportIssueDocument>) ??
  mongoose.model<SupportIssueDocument>("SupportIssue", supportIssueSchema);
