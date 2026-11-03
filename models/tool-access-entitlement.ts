import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { TOOL_ACCESS_TOOLS } from "@/lib/tool-access-policy";

const toolAccessEntitlementSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    tool: { type: String, enum: TOOL_ACCESS_TOOLS, required: true },
    policyKey: { type: String, required: true, trim: true, maxlength: 80 },
    policyDurationMonths: { type: Number, required: true, min: 1, max: 120 },
    courseSlug: { type: String, required: true, trim: true, lowercase: true, default: "agent" },
    enrollmentId: { type: mongoose.Schema.Types.ObjectId, default: null },
    grantedBatchNo: { type: Number, min: 1, default: null },
    sourceRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "n8n-access-request",
      required: true,
      unique: true,
    },
    grantedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    revocationReason: { type: String, trim: true, maxlength: 80, default: null },
  },
  { timestamps: true, collection: "tool-access-entitlements" },
);

// One non-renewable entitlement per policy. A future paid renewal must use a
// new explicit policy key rather than silently moving the original expiry.
toolAccessEntitlementSchema.index(
  { studentId: 1, policyKey: 1 },
  { name: "tool-access-entitlements-student-policy-unique", unique: true },
);
toolAccessEntitlementSchema.index(
  { expiresAt: 1, revokedAt: 1 },
  { name: "tool-access-entitlements-expiry-queue" },
);

export type ToolAccessEntitlementDocument = InferSchemaType<typeof toolAccessEntitlementSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ToolAccessEntitlementModel: Model<ToolAccessEntitlementDocument> =
  (mongoose.models["tool-access-entitlement"] as Model<ToolAccessEntitlementDocument>) ??
  mongoose.model<ToolAccessEntitlementDocument>(
    "tool-access-entitlement",
    toolAccessEntitlementSchema,
  );
