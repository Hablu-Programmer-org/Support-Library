import "server-only";

import { normalizeEmail } from "@/lib/email";
import { getLmsMongoClient } from "@/lib/lms-db";
import { pickStudentCourses, type LmsEnrollmentRow } from "@/lib/lms-courses";
import { escapeRegex } from "@/lib/search";

const getLmsDbName = () => process.env.LMS_MONGODB_DB || "hp-v2";

export type LmsUser = {
  userId: string;
  email: string;
  name: string | null;
  role: string | null;
  image: string | null;
  isActive: boolean;
};

const toLmsUser = (doc: Record<string, unknown> | null): LmsUser | null => {
  if (!doc) return null;
  return {
    userId: String(doc.userId ?? ""),
    email: String(doc.email ?? ""),
    name: typeof doc.name === "string" ? doc.name : String(doc.name ?? "") || null,
    role: typeof doc.role === "string" ? doc.role : null,
    image: typeof doc.image === "string" ? doc.image : null,
    isActive: doc.isActive !== false,
  };
};

/**
 * Read-only lookup in the main Hablu Programmer database (hp-v2).
 *
 * Tries the exact normalized email first (indexed), then falls back to a
 * case-insensitive match for rows stored with different casing.
 */
export const findLmsUserByEmail = async (email?: string | null): Promise<LmsUser | null> => {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const client = await getLmsMongoClient();
  const users = client.db(getLmsDbName()).collection("User");

  const exact = await users.findOne(
    { email: normalized },
    { projection: { userId: 1, email: 1, name: 1, role: 1, image: 1, isActive: 1 } },
  );

  const doc = exact ?? (await users.findOne(
    { email: { $regex: `^${escapeRegex(normalized)}$`, $options: "i" } },
    { projection: { userId: 1, email: 1, name: 1, role: 1, image: 1, isActive: 1 } },
  ));

  return toLmsUser(doc as Record<string, unknown> | null);
};

export type LmsStudentLookup = { userId: string; name: string };

/**
 * The courses a student is enrolled in, with the batch of that enrolment.
 *
 * Read-only, like every other LMS access: the support request simply records the
 * course/batch the student picked, and the student form derives the batch from
 * this list instead of letting the browser type it.
 */
export const listStudentCourses = async (email?: string | null) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return [];

  const client = await getLmsMongoClient();
  const db = client.db(getLmsDbName());

  const projection = { _id: 1 };
  const user =
    (await db.collection("User").findOne({ email: normalized }, { projection })) ??
    (await db.collection("User").findOne(
      { email: { $regex: `^${escapeRegex(normalized)}$`, $options: "i" } },
      { projection },
    ));
  if (!user?._id) return [];

  const rows = await db
    .collection("EnrolledCourse")
    .find(
      { userId: user._id },
      { projection: { courseSlug: 1, batchNo: 1, status: 1 } },
    )
    .toArray();

  const courses = pickStudentCourses(rows as LmsEnrollmentRow[]);
  if (courses.length === 0) return [];

  // Names are cosmetic; a missing Course row falls back to the slug.
  const courseDocs = await db
    .collection("Course")
    .find(
      { slug: { $in: courses.map((course) => course.slug) } },
      { projection: { slug: 1, name: 1 } },
    )
    .toArray();
  const nameBySlug = new Map(
    courseDocs.map((course) => [String(course.slug), String(course.name ?? course.slug)]),
  );

  return pickStudentCourses(rows as LmsEnrollmentRow[], nameBySlug);
};
/**
 * Email autocomplete lookup for the issue form. hp-v2 only: a matched email
 * lets the form prefill the student's name.
 */
export const lookupLmsStudent = async (email: string): Promise<LmsStudentLookup | null> => {
  const user = await findLmsUserByEmail(email);
  if (!user) return null;
  return { userId: user.userId, name: user.name || user.email };
};
