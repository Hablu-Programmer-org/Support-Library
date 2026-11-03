import mongoose, { type InferSchemaType, type Model } from "mongoose";

export const N8N_REQUEST_TYPES = ["ACCESS", "PASSWORD_RESET", "OPENAI_ACCESS"] as const;
export const N8N_REQUEST_STATUSES = ["PENDING", "PROCESSING", "SENT", "FAILED", "SUPERSEDED"] as const;

const n8nAccessRequestSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
    requestType: { type: String, enum: N8N_REQUEST_TYPES, required: true, index: true },
    status: { type: String, enum: N8N_REQUEST_STATUSES, required: true, default: "PENDING", index: true },
    attempts: { type: Number, required: true, default: 0, min: 0 },
    processingStartedAt: { type: Date, default: null },
    processingExpiresAt: { type: Date, default: null },
    processingLeaseId: { type: String, default: null, maxlength: 80, select: false },
    sentAt: { type: Date, default: null },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null, index: true },
    failureCode: { type: String, default: null, maxlength: 40 },
    purpose: { type: String, trim: true, maxlength: 300, default: null },
    // Snapshot of the fixed-course context. `agent` is the only course whose
    // students may receive n8n/OpenAI access, so the queue can show the batch
    // even if the LMS enrolment row is later paused or moved.
    courseSlug: { type: String, trim: true, lowercase: true, default: "agent" },
    batchNo: { type: Number, min: 1, default: null },
    enrollmentId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true, collection: "n8n-access-requests" },
);

n8nAccessRequestSchema.index({ createdAt: -1 });
n8nAccessRequestSchema.index(
  { requestType: 1, status: 1, createdAt: -1, _id: -1 },
  { name: "n8n-access-requests-staff-queue" },
);
n8nAccessRequestSchema.index(
  { studentId: 1, requestType: 1 },
  {
    name: "n8n-access-requests-student-type-active-unique",
    unique: true,
    partialFilterExpression: { status: { $in: ["PENDING", "PROCESSING"] } },
  },
);

export type N8nAccessRequestDocument = InferSchemaType<typeof n8nAccessRequestSchema> & {
  _id: mongoose.Types.ObjectId;
};
export type N8nRequestType = (typeof N8N_REQUEST_TYPES)[number];
export type N8nRequestStatus = (typeof N8N_REQUEST_STATUSES)[number];

export const N8nAccessRequestModel: Model<N8nAccessRequestDocument> =
  (mongoose.models["n8n-access-request"] as Model<N8nAccessRequestDocument>) ??
  mongoose.model<N8nAccessRequestDocument>("n8n-access-request", n8nAccessRequestSchema);
