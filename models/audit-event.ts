import mongoose, { type InferSchemaType, type Model } from "mongoose";

export const AUDIT_ACTIONS = [
  "ISSUE_CREATE",
  "ISSUE_UPDATE",
  "ISSUE_STATUS_CHANGE",
  "ISSUE_PUBLISH",
  "ISSUE_UNPUBLISH",
  "ISSUE_ARCHIVE",
  "REPLY_CREATE",
  "REPLY_EDIT",
  "REPLY_DELETE",
  "OAUTH_CALLBACK",
] as const;

export const AUDIT_RESULTS = ["SUCCEEDED", "DENIED"] as const;

const auditEventSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
    action: { type: String, enum: AUDIT_ACTIONS, required: true, index: true },
    resourceType: { type: String, enum: ["SupportIssue", "SupportReply", "OAuthCallback"], required: true },
    resourceId: { type: String, required: true, trim: true, maxlength: 64 },
    result: { type: String, enum: AUDIT_RESULTS, required: true, index: true },
    timestamp: { type: Date, required: true, default: Date.now, index: true },
    // Request context for forensic analysis
    ip: { type: String, trim: true, maxlength: 45 },
    userAgent: { type: String, trim: true, maxlength: 512 },
    requestId: { type: String, trim: true, maxlength: 64 },
  },
  {
    collection: "audit-events",
    versionKey: false,
  },
);

auditEventSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });
auditEventSchema.index({ ip: 1, timestamp: -1 });
auditEventSchema.index({ requestId: 1 });

export type AuditEventDocument = InferSchemaType<typeof auditEventSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AuditEventModel: Model<AuditEventDocument> =
  (mongoose.models["audit-event"] as Model<AuditEventDocument>) ??
  mongoose.model<AuditEventDocument>("audit-event", auditEventSchema);
