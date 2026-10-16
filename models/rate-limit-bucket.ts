import mongoose, { type InferSchemaType, type Model } from "mongoose";

const rateLimitBucketSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, maxlength: 200 },
    count: { type: Number, required: true, min: 1 },
    expiresAt: { type: Date, required: true },
  },
  {
    collection: "rate-limit-buckets",
    versionKey: false,
  },
);

rateLimitBucketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RateLimitBucketDocument = InferSchemaType<typeof rateLimitBucketSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const RateLimitBucketModel: Model<RateLimitBucketDocument> =
  (mongoose.models["rate-limit-bucket"] as Model<RateLimitBucketDocument>) ??
  mongoose.model<RateLimitBucketDocument>("rate-limit-bucket", rateLimitBucketSchema);
