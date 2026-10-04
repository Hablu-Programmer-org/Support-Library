import "server-only";

import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";
import { buildSearchRegex, joinSearchText } from "@/lib/search";
import { listCasesByStudent } from "@/lib/services/cases";
import { studentRefInputSchema, type StudentRefInput } from "@/lib/validation";
import { StudentRefModel } from "@/models";

export type StudentListParams = {
  q?: string;
  page?: number;
  limit?: number;
};

export type StudentListItem = {
  id: string;
  name: string;
  studentId?: string | null;
  lmsUserId?: string | null;
  email?: string | null;
  phone?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export const buildStudentSearchText = (student: Pick<StudentRefInput, "name" | "email" | "phone" | "studentId" | "lmsUserId">) =>
  joinSearchText([student.name, student.email, student.phone, student.studentId, student.lmsUserId]);

const toStudentListItem = (student: Record<string, unknown>): StudentListItem => ({
  id: String(student._id),
  name: String(student.name),
  studentId: student.studentId as string | null | undefined,
  lmsUserId: student.lmsUserId as string | null | undefined,
  email: student.email as string | null | undefined,
  phone: student.phone as string | null | undefined,
  createdAt: student.createdAt as Date | undefined,
  updatedAt: student.updatedAt as Date | undefined,
});

export async function createStudent(input: StudentRefInput, actorId: string) {
  const parsed = studentRefInputSchema.parse(input);
  await dbConnect();

  const student = await StudentRefModel.create({
    ...parsed,
    searchText: buildStudentSearchText(parsed),
    createdBy: new mongoose.Types.ObjectId(actorId),
    updatedBy: new mongoose.Types.ObjectId(actorId),
  });

  return toStudentListItem(student.toObject());
}

export async function updateStudent(id: string, input: StudentRefInput, actorId: string) {
  const parsed = studentRefInputSchema.parse(input);
  await dbConnect();

  const student = await StudentRefModel.findByIdAndUpdate(
    id,
    {
      ...parsed,
      searchText: buildStudentSearchText(parsed),
      updatedBy: new mongoose.Types.ObjectId(actorId),
    },
    { new: true, runValidators: true },
  ).lean();

  return student ? toStudentListItem(student) : null;
}

export async function getStudentById(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  await dbConnect();

  const student = await StudentRefModel.findById(id).lean();
  return student ? toStudentListItem(student) : null;
}

export async function listStudents(params: StudentListParams = {}) {
  await dbConnect();

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const q = params.q?.trim();
  const searchRegex = buildSearchRegex(q);
  const filter = searchRegex ? { searchText: searchRegex } : {};

  const [items, total] = await Promise.all([
    StudentRefModel.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    StudentRefModel.countDocuments(filter),
  ]);

  return {
    items: items.map(toStudentListItem),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getStudentHistory(id: string) {
  const student = await getStudentById(id);
  const cases = student ? await listCasesByStudent(id, 20) : null;
  return { student, cases: cases?.items ?? [] };
}
