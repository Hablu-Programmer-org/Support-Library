import mongoose, { type InferSchemaType, type Model } from "mongoose";

export const N8N_REQUEST_TYPES = ["ACCESS", "PASSWORD_RESET", "OPENAI_ACCESS"] as const;
export const N8N_REQUEST_STATUSES = ["PENDING", "PROCESSING", "SENT", "FAILED"] as const;

const n8nAccessRequestSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
    requestType: { type: String, enum: N8N_REQUEST_TYPES, required: true, index: true },
    status: { type: String, enum: N8N_REQUEST_STATUSES, required: true, default: "PENDING", index: true },
    attempts: { type: Number, required: true, default: 0, min: 0 },
    processingStartedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null, index: true },
    failureCode: { type: String, default: null, maxlength: 40 },
    purpose: { type: String, trim: true, maxlength: 300, default: null },
  },
  { timestamps: true, collection: "n8n-access-requests" },
);

n8nAccessRequestSchema.index({ createdAt: -1 });
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
