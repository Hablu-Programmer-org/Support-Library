import mongoose, { type InferSchemaType, type Model } from "mongoose";

export const ACCESS_EMAIL_NOTIFICATION_TYPES = [
  "N8N_ACCESS",
  "N8N_PASSWORD_RESET",
  "OPENAI_CONFIRMATION",
  "ACCESS_REJECTION",
] as const;
export const ACCESS_EMAIL_OUTBOX_STATUSES = [
  "QUEUED",
  "SENDING",
  "SMTP_ACCEPTED",
  "RETRY",
  "SENT",
  "FAILED",
  "EXPIRED",
] as const;

const encryptedPayloadSchema = new mongoose.Schema(
  {
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    keyVersion: { type: String, required: true, maxlength: 20 },
  },
  { _id: false },
);

const accessEmailOutboxSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "n8n-access-request",
      required: true,
    },
    notificationType: {
      type: String,
      enum: ACCESS_EMAIL_NOTIFICATION_TYPES,
      required: true,
    },
    generation: { type: Number, required: true, min: 1 },
    supersedesJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "access-email-outbox",
      default: null,
    },
    status: {
      type: String,
      enum: ACCESS_EMAIL_OUTBOX_STATUSES,
      required: true,
      default: "QUEUED",
    },
    attempts: { type: Number, required: true, default: 0, min: 0 },
    nextAttemptAt: { type: Date, required: true, default: Date.now },
    leaseId: { type: String, default: null, maxlength: 80, select: false },
    leaseExpiresAt: { type: Date, default: null },
    messageId: { type: String, required: true, maxlength: 180 },
    encryptedPayload: { type: encryptedPayloadSchema, default: null, select: false },
    payloadExpiresAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    providerAcceptedAt: { type: Date, default: null },
    providerCode: { type: String, default: null, maxlength: 40 },
    lastErrorCode: { type: String, default: null, maxlength: 60 },
    sentAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    purgeAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "access-email-outboxes" },
);

accessEmailOutboxSchema.index(
  { requestId: 1, notificationType: 1, generation: 1 },
  { name: "access-email-outboxes-request-notification-generation-unique", unique: true },
);
accessEmailOutboxSchema.index(
  { status: 1, nextAttemptAt: 1, leaseExpiresAt: 1 },
  { name: "access-email-outboxes-delivery-queue" },
);
accessEmailOutboxSchema.index(
  { status: 1, leaseExpiresAt: 1 },
  { name: "access-email-outboxes-finalization-recovery" },
);
accessEmailOutboxSchema.index(
  { payloadExpiresAt: 1, status: 1 },
  { name: "access-email-outboxes-secret-expiry" },
);
accessEmailOutboxSchema.index(
  { purgeAt: 1 },
  { name: "access-email-outboxes-purge-ttl", expireAfterSeconds: 0 },
);

export type AccessEmailOutboxDocument = InferSchemaType<typeof accessEmailOutboxSchema> & {
  _id: mongoose.Types.ObjectId;
};
export type AccessEmailNotificationType = (typeof ACCESS_EMAIL_NOTIFICATION_TYPES)[number];
export type AccessEmailOutboxStatus = (typeof ACCESS_EMAIL_OUTBOX_STATUSES)[number];

export const AccessEmailOutboxModel: Model<AccessEmailOutboxDocument> =
  (mongoose.models["access-email-outbox"] as Model<AccessEmailOutboxDocument>) ??
  mongoose.model<AccessEmailOutboxDocument>("access-email-outbox", accessEmailOutboxSchema);
