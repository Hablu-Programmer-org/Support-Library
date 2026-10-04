import mongoose, { type InferSchemaType, type Model } from "mongoose";

const caseSolutionLinkSchema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupportCase",
      required: true,
      index: true,
    },
    solutionArticleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SolutionArticle",
      required: true,
      index: true,
    },
    linkedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  {
    timestamps: true,
    collection: "case_solution_links",
  },
);

caseSolutionLinkSchema.index({ caseId: 1, solutionArticleId: 1 }, { unique: true });
caseSolutionLinkSchema.index({ solutionArticleId: 1, createdAt: -1 });

export type CaseSolutionLinkDocument = InferSchemaType<typeof caseSolutionLinkSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const CaseSolutionLinkModel: Model<CaseSolutionLinkDocument> =
  (mongoose.models.CaseSolutionLink as Model<CaseSolutionLinkDocument>) ??
  mongoose.model<CaseSolutionLinkDocument>("CaseSolutionLink", caseSolutionLinkSchema);
