import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { SOLUTION_VISIBILITIES, externalFileLinkSchema, videoLinkSchema } from "./shared";

const solutionArticleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 200 },
    slug: { type: String, required: true, trim: true, unique: true, index: true },
    summary: { type: String, required: true, trim: true, minlength: 5, maxlength: 500 },
    body: { type: String, required: true, trim: true, minlength: 10, maxlength: 100_000 },
    tags: { type: [String], default: [], index: true },
    visibility: { type: String, enum: SOLUTION_VISIBILITIES, default: "INTERNAL", index: true },
    fileLinks: { type: [externalFileLinkSchema], default: [] },
    videoLinks: { type: [videoLinkSchema], default: [] },
    searchText: { type: String, required: true, trim: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    collection: "solution_articles",
  },
);

solutionArticleSchema.index({ visibility: 1, tags: 1 });

export type SolutionArticleDocument = InferSchemaType<typeof solutionArticleSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SolutionArticleModel: Model<SolutionArticleDocument> =
  (mongoose.models.SolutionArticle as Model<SolutionArticleDocument>) ??
  mongoose.model<SolutionArticleDocument>("SolutionArticle", solutionArticleSchema);
