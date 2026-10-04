import "server-only";

import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";
import { CaseSolutionLinkModel, SolutionArticleModel, SupportCaseModel } from "@/models";
import type { SolutionListItem } from "@/lib/services/solutions";
import type { SupportCaseListItem } from "@/lib/services/cases";

type LeanDoc = Record<string, unknown>;

const toSolution = (solution: LeanDoc): SolutionListItem => ({
  id: String(solution._id),
  title: String(solution.title),
  slug: String(solution.slug),
  summary: String(solution.summary),
  body: String(solution.body),
  tags: Array.isArray(solution.tags) ? solution.tags as string[] : [],
  visibility: solution.visibility as SolutionListItem["visibility"],
  fileLinks: Array.isArray(solution.fileLinks) ? solution.fileLinks as SolutionListItem["fileLinks"] : [],
  videoLinks: Array.isArray(solution.videoLinks) ? solution.videoLinks as SolutionListItem["videoLinks"] : [],
  createdAt: solution.createdAt as Date | undefined,
  updatedAt: solution.updatedAt as Date | undefined,
});

const toCase = (supportCase: LeanDoc): SupportCaseListItem => ({
  id: String(supportCase._id),
  studentRefId: String(supportCase.studentRefId),
  title: String(supportCase.title),
  question: String(supportCase.question),
  status: supportCase.status as SupportCaseListItem["status"],
  priority: supportCase.priority as string | null | undefined,
  courseSlug: supportCase.courseSlug as string | null | undefined,
  batchNo: supportCase.batchNo as number | null | undefined,
  tags: Array.isArray(supportCase.tags) ? supportCase.tags as string[] : [],
  createdAt: supportCase.createdAt as Date | undefined,
  updatedAt: supportCase.updatedAt as Date | undefined,
});

export async function linkSolutionToCase(caseId: string, solutionArticleId: string, linkedBy: string) {
  if (!mongoose.Types.ObjectId.isValid(caseId) || !mongoose.Types.ObjectId.isValid(solutionArticleId)) return null;
  await dbConnect();

  return CaseSolutionLinkModel.findOneAndUpdate(
    { caseId, solutionArticleId },
    {
      $setOnInsert: {
        caseId: new mongoose.Types.ObjectId(caseId),
        solutionArticleId: new mongoose.Types.ObjectId(solutionArticleId),
        linkedBy: new mongoose.Types.ObjectId(linkedBy),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
}

export async function unlinkSolutionFromCase(caseId: string, solutionArticleId: string) {
  if (!mongoose.Types.ObjectId.isValid(caseId) || !mongoose.Types.ObjectId.isValid(solutionArticleId)) return null;
  await dbConnect();
  return CaseSolutionLinkModel.findOneAndDelete({ caseId, solutionArticleId }).lean();
}

export async function listSolutionsForCase(caseId: string) {
  if (!mongoose.Types.ObjectId.isValid(caseId)) return [];
  await dbConnect();

  const links = await CaseSolutionLinkModel.find({ caseId }).sort({ createdAt: -1 }).lean();
  const ids = links.map((link) => link.solutionArticleId);
  if (!ids.length) return [];

  const solutions = await SolutionArticleModel.find({ _id: { $in: ids }, deletedAt: null }).lean();
  return (solutions as LeanDoc[]).map(toSolution);
}

export async function listCasesForSolution(solutionArticleId: string) {
  if (!mongoose.Types.ObjectId.isValid(solutionArticleId)) return [];
  await dbConnect();

  const links = await CaseSolutionLinkModel.find({ solutionArticleId }).sort({ createdAt: -1 }).lean();
  const ids = links.map((link) => link.caseId);
  if (!ids.length) return [];

  const cases = await SupportCaseModel.find({ _id: { $in: ids }, deletedAt: null }).lean();
  return (cases as LeanDoc[]).map(toCase);
}
