import "server-only";

import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";
import { buildSearchRegex, joinSearchText } from "@/lib/search";
import { supportCaseInputSchema, type SupportCaseFilter, type SupportCaseInput } from "@/lib/validation";
import { StudentRefModel, SupportCaseModel, type CaseStatus } from "@/models";

type LeanDoc = Record<string, unknown>;

export type SupportCaseListItem = {
  id: string;
  studentRefId: string;
  studentName?: string;
  studentEmail?: string | null;
  studentId?: string | null;
  title: string;
  question: string;
  status: CaseStatus;
  priority?: string | null;
  courseSlug?: string | null;
  batchNo?: number | null;
  tags: string[];
  createdAt?: Date;
  updatedAt?: Date;
};

export type CaseListParams = SupportCaseFilter & {
  page?: number;
  limit?: number;
};

export const buildCaseSearchText = (input: Pick<SupportCaseInput, "title" | "question" | "courseSlug" | "moduleSlug" | "contentSlug" | "tags">) =>
  joinSearchText([input.title, input.question, input.courseSlug, input.moduleSlug, input.contentSlug, ...(input.tags ?? [])]);

const toCaseListItem = (item: LeanDoc, students: Map<string, LeanDoc> = new Map()): SupportCaseListItem => {
  const studentRefId = String(item.studentRefId);
  const student = students.get(studentRefId);

  return {
    id: String(item._id),
    studentRefId,
    studentName: student?.name as string | undefined,
    studentEmail: student?.email as string | null | undefined,
    studentId: student?.studentId as string | null | undefined,
    title: String(item.title),
    question: String(item.question),
    status: item.status as CaseStatus,
    priority: item.priority as string | null | undefined,
    courseSlug: item.courseSlug as string | null | undefined,
    batchNo: item.batchNo as number | null | undefined,
    tags: Array.isArray(item.tags) ? item.tags as string[] : [],
    createdAt: item.createdAt as Date | undefined,
    updatedAt: item.updatedAt as Date | undefined,
  };
};

async function buildStudentMap(cases: LeanDoc[]) {
  const ids = [...new Set(cases.map((item) => String(item.studentRefId)).filter(Boolean))];
  if (!ids.length) return new Map<string, LeanDoc>();

  const students = await StudentRefModel.find({ _id: { $in: ids } })
    .select("name email studentId")
    .lean();

  return new Map(students.map((student) => [String(student._id), student as LeanDoc]));
}

function buildCaseFilter(params: CaseListParams = {}) {
  const filter: Record<string, unknown> = { deletedAt: null };

  if (params.status) filter.status = params.status;
  if (params.courseSlug) filter.courseSlug = params.courseSlug;
  if (params.batchNo) filter.batchNo = params.batchNo;
  if (params.tag) filter.tags = params.tag.toLowerCase();
  if (params.mentorId && mongoose.Types.ObjectId.isValid(params.mentorId)) filter.mentorId = params.mentorId;
  if (params.studentRefId && mongoose.Types.ObjectId.isValid(params.studentRefId)) filter.studentRefId = params.studentRefId;
  const searchRegex = buildSearchRegex(params.q);
  if (searchRegex) filter.searchText = searchRegex;
  if (params.from || params.to) {
    filter.createdAt = {
      ...(params.from ? { $gte: new Date(params.from) } : {}),
      ...(params.to ? { $lte: new Date(params.to) } : {}),
    };
  }

  return filter;
}

export async function createCase(input: SupportCaseInput, actorId: string) {
  const parsed = supportCaseInputSchema.parse(input);
  await dbConnect();

  const supportCase = await SupportCaseModel.create({
    ...parsed,
    searchText: buildCaseSearchText(parsed),
    mentorId: parsed.mentorId ? new mongoose.Types.ObjectId(parsed.mentorId) : new mongoose.Types.ObjectId(actorId),
    createdBy: new mongoose.Types.ObjectId(actorId),
    updatedBy: new mongoose.Types.ObjectId(actorId),
  });

  return toCaseListItem(supportCase.toObject());
}

export async function updateCase(id: string, input: SupportCaseInput, actorId: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  const parsed = supportCaseInputSchema.parse(input);
  await dbConnect();

  const supportCase = await SupportCaseModel.findOneAndUpdate(
    { _id: id, deletedAt: null },
    {
      ...parsed,
      searchText: buildCaseSearchText(parsed),
      updatedBy: new mongoose.Types.ObjectId(actorId),
    },
    { new: true, runValidators: true },
  ).lean();

  return supportCase ? toCaseListItem(supportCase) : null;
}

export async function changeCaseStatus(id: string, status: CaseStatus, actorId: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  await dbConnect();

  const supportCase = await SupportCaseModel.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { status, updatedBy: new mongoose.Types.ObjectId(actorId) },
    { new: true, runValidators: true },
  ).lean();

  return supportCase ? toCaseListItem(supportCase) : null;
}

export async function softDeleteCase(id: string, actorId: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  await dbConnect();

  const supportCase = await SupportCaseModel.findOneAndUpdate(
    { _id: id, deletedAt: null },
    {
      deletedAt: new Date(),
      deletedBy: new mongoose.Types.ObjectId(actorId),
      updatedBy: new mongoose.Types.ObjectId(actorId),
    },
    { new: true },
  ).lean();

  return supportCase ? toCaseListItem(supportCase) : null;
}

export async function listCases(params: CaseListParams = {}) {
  await dbConnect();

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const filter = buildCaseFilter(params);

  const [items, total] = await Promise.all([
    SupportCaseModel.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    SupportCaseModel.countDocuments(filter),
  ]);
  const students = await buildStudentMap(items as LeanDoc[]);

  return {
    items: (items as LeanDoc[]).map((item) => toCaseListItem(item, students)),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function listCasesByStudent(studentRefId: string, limit = 20) {
  return listCases({ studentRefId, page: 1, limit });
}

export async function getCaseDetail(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  await dbConnect();

  const supportCase = await SupportCaseModel.findOne({ _id: id, deletedAt: null }).lean();
  if (!supportCase) return null;

  const students = await buildStudentMap([supportCase as LeanDoc]);
  return toCaseListItem(supportCase as LeanDoc, students);
}
