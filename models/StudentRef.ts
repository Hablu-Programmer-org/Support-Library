import mongoose, { type InferSchemaType, type Model } from "mongoose";

const studentRefSchema = new mongoose.Schema(
  {
    lmsUserId: { type: String, trim: true, maxlength: 64, default: null },
    studentId: { type: String, trim: true, maxlength: 32, default: null },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true, default: null },
    phone: { type: String, trim: true, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    searchText: { type: String, required: true, trim: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    collection: "student_refs",
  },
);

studentRefSchema.index({ studentId: 1 }, { sparse: true });
studentRefSchema.index({ email: 1 }, { sparse: true });
studentRefSchema.index({ phone: 1 }, { sparse: true });
studentRefSchema.index({ lmsUserId: 1 }, { sparse: true });

export type StudentRefDocument = InferSchemaType<typeof studentRefSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const StudentRefModel: Model<StudentRefDocument> =
  (mongoose.models.StudentRef as Model<StudentRefDocument>) ??
  mongoose.model<StudentRefDocument>("StudentRef", studentRefSchema);
