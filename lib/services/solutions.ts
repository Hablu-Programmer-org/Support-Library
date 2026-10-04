import "server-only";

import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";
import { buildSearchRegex, joinSearchText } from "@/lib/search";
import { slugify } from "@/lib/slug";
import { solutionArticleInputSchema, type SolutionArticleInput } from "@/lib/validation";
import { SolutionArticleModel, type SolutionVisibility } from "@/models";

type LeanDoc = Record<string, unknown>;

export type SolutionListItem = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  tags: string[];
  visibility: SolutionVisibility;
  fileLinks: Array<{ title: string; url: string; type?: string | null; note?: string | null }>;
  videoLinks: Array<{ title: string; url: string; timestamp?: string | null; summary?: string | null }>;
  createdAt?: Date;
  updatedAt?: Date;
};

export type SolutionListParams = {
  q?: string;
  tag?: string;
  visibility?: SolutionVisibility;
  page?: number;
  limit?: number;
};

export const buildSolutionSearchText = (input: Pick<SolutionArticleInput, "title" | "summary" | "body" | "tags">) =>
  joinSearchText([input.title, input.summary, input.body, ...(input.tags ?? [])]);

const toSolutionListItem = (solution: LeanDoc): SolutionListItem => ({
  id: String(solution._id),
  title: String(solution.title),
  slug: String(solution.slug),
  summary: String(solution.summary),
  body: String(solution.body),
  tags: Array.isArray(solution.tags) ? solution.tags as string[] : [],
  visibility: solution.visibility as SolutionVisibility,
  fileLinks: Array.isArray(solution.fileLinks) ? solution.fileLinks as SolutionListItem["fileLinks"] : [],
  videoLinks: Array.isArray(solution.videoLinks) ? solution.videoLinks as SolutionListItem["videoLinks"] : [],
  createdAt: solution.createdAt as Date | undefined,
  updatedAt: solution.updatedAt as Date | undefined,
});

async function ensureUniqueSlug(title: string, requestedSlug?: string) {
  const base = slugify(requestedSlug || title);
  let slug = base;
  let counter = 2;

  while (await SolutionArticleModel.exists({ slug })) {
    slug = `${base}-${counter}`;
    counter += 1;
  }

  return slug;
}

export async function createSolution(input: SolutionArticleInput, actorId: string) {
  const parsed = solutionArticleInputSchema.parse(input);
  await dbConnect();

  const slug = await ensureUniqueSlug(parsed.title, parsed.slug);
  const solution = await SolutionArticleModel.create({
    ...parsed,
    slug,
    visibility: parsed.visibility ?? "INTERNAL",
    searchText: buildSolutionSearchText(parsed),
    createdBy: new mongoose.Types.ObjectId(actorId),
    updatedBy: new mongoose.Types.ObjectId(actorId),
  });

  return toSolutionListItem(solution.toObject());
}

export async function updateSolution(slug: string, input: SolutionArticleInput, actorId: string) {
  const parsed = solutionArticleInputSchema.parse(input);
  await dbConnect();

  const existing = await SolutionArticleModel.findOne({ slug, deletedAt: null }).lean();
  if (!existing) return null;

  const nextSlug = parsed.slug && parsed.slug !== slug ? await ensureUniqueSlug(parsed.title, parsed.slug) : slug;
  const solution = await SolutionArticleModel.findOneAndUpdate(
    { slug, deletedAt: null },
    {
      ...parsed,
      slug: nextSlug,
      searchText: buildSolutionSearchText(parsed),
      updatedBy: new mongoose.Types.ObjectId(actorId),
    },
    { new: true, runValidators: true },
  ).lean();

  return solution ? toSolutionListItem(solution) : null;
}

export async function listSolutions(params: SolutionListParams = {}) {
  await dbConnect();

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const filter: Record<string, unknown> = { deletedAt: null };
  if (params.visibility) filter.visibility = params.visibility;
  if (params.tag) filter.tags = params.tag.toLowerCase();
  const searchRegex = buildSearchRegex(params.q);
  if (searchRegex) filter.searchText = searchRegex;

  const [items, total] = await Promise.all([
    SolutionArticleModel.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    SolutionArticleModel.countDocuments(filter),
  ]);

  return {
    items: (items as LeanDoc[]).map(toSolutionListItem),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getSolutionBySlug(slug: string) {
  await dbConnect();
  const solution = await SolutionArticleModel.findOne({ slug, deletedAt: null }).lean();
  return solution ? toSolutionListItem(solution as LeanDoc) : null;
}

export async function softDeleteSolution(slug: string, actorId: string) {
  await dbConnect();
  const solution = await SolutionArticleModel.findOneAndUpdate(
    { slug, deletedAt: null },
    { deletedAt: new Date(), updatedBy: new mongoose.Types.ObjectId(actorId) },
    { new: true },
  ).lean();
  return solution ? toSolutionListItem(solution) : null;
}

export async function publishSolution(slug: string, actorId: string) {
  await dbConnect();
  const solution = await SolutionArticleModel.findOneAndUpdate(
    { slug, deletedAt: null },
    { visibility: "PUBLIC", updatedBy: new mongoose.Types.ObjectId(actorId) },
    { new: true, runValidators: true },
  ).lean();
  return solution ? toSolutionListItem(solution) : null;
}
