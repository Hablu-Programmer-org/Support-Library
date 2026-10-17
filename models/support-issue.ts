import mongoose, { type InferSchemaType, type Model } from "mongoose";

import {
  CASE_PRIORITIES,
  CASE_STATUSES,
  ISSUE_VISIBILITIES,
  uploadAttachmentSchema,
  videoLinkSchema,
} from "./shared";

const encryptedStudentEmailSchema = new mongoose.Schema(
  {
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    keyVersion: { type: String, required: true },
  },
  { _id: false },
);

const studentEmailLookupSchema = new mongoose.Schema(
  {
    digest: { type: String, required: true },
    keyVersion: { type: String, required: true },
  },
  { _id: false },
);

const publicationEventSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["PUBLISHED", "UNPUBLISHED", "CONTENT_CHANGED", "PUBLIC_REPLY_CHANGED", "ARCHIVED"],
      required: true,
    },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const supportIssueSchema = new mongoose.Schema(
  {
    studentName: { type: String, trim: true, maxlength: 120, default: null },
    // Legacy fields remain readable only until the guarded migration removes them.
    studentEmail: { type: String, select: false },
    studentEmailHash: { type: String, select: false },
    studentEmailEncrypted: { type: encryptedStudentEmailSchema, default: null },
    studentEmailLookup: { type: studentEmailLookupSchema, default: null },
    lmsUserId: { type: String, default: null },
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 200 },
    question: { type: String, required: true, trim: true, minlength: 5, maxlength: 20_000 },
    // Evidence the reporter attached to the problem itself (before any reply):
    // external video links plus images uploaded to the private object store.
    // Uploads are served only through the authorized attachment proxy.
    videoLinks: { type: [videoLinkSchema], default: [] },
    uploads: { type: [uploadAttachmentSchema], default: [] },
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
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    publicationHistory: { type: [publicationEventSchema], default: [] },
    mentorId: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null, index: true },
    searchText: { type: String, required: true, trim: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    createOperationId: { type: String, default: null },
    createOperationHash: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: "support-issues",
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

// Supports `/api/attachments/[id]`, which has to find the owning issue by the
// embedded attachment id before it can authorize the download.
supportIssueSchema.index({ "uploads._id": 1 });

export type SupportIssueDocument = InferSchemaType<typeof supportIssueSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SupportIssueModel: Model<SupportIssueDocument> =
  (mongoose.models["support-issue"] as Model<SupportIssueDocument>) ??
  mongoose.model<SupportIssueDocument>("support-issue", supportIssueSchema);
