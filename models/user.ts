import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { USER_ROLES } from "@/lib/constants";
export type UserRole = (typeof USER_ROLES)[number];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    image: { type: String, default: null },
    role: { type: String, enum: USER_ROLES, default: "VIEWER", index: true },
    isActive: { type: Boolean, default: true, index: true },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: "staff-users",
  },
);

export type UserDocument = InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const UserModel: Model<UserDocument> =
  (mongoose.models.user as Model<UserDocument>) ??
  mongoose.model<UserDocument>("user", userSchema);
