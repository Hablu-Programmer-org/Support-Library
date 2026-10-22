/**
 * Pure helpers for the student course picker.
 *
 * The LMS stores one `EnrolledCourse` row per enrolment, and a student can hold
 * several rows for the same course (re-enrolment, batch change). The picker must
 * show one entry per course, with the batch that student is actually in, so the
 * request carries the right context. Kept dependency-free so it can be tested
 * without a database connection.
 */

export type LmsEnrollmentRow = {
  courseSlug?: unknown;
  batchNo?: unknown;
  status?: unknown;
};

export type LmsStudentCourse = {
  slug: string;
  name: string;
  batchNo: number;
  /** `running` | `completed` | null, straight from the enrolment row. */
  status: string | null;
};

const toBatch = (value: unknown) => {
  const batch = Number(value);
  return Number.isFinite(batch) && batch > 0 ? Math.trunc(batch) : 0;
};

/**
 * One entry per course: a running enrolment beats a completed one, and a higher
 * batch beats a lower one, so `jfwd · batch 2` never hides behind `jfwd · batch 1`.
 */
export function pickStudentCourses(
  rows: LmsEnrollmentRow[],
  nameBySlug: Map<string, string> = new Map(),
): LmsStudentCourse[] {
  const bySlug = new Map<string, LmsStudentCourse>();

  for (const row of rows) {
    const slug = typeof row.courseSlug === "string" ? row.courseSlug.trim() : "";
    if (!slug) continue;

    const status = typeof row.status === "string" ? row.status : null;
    const candidate: LmsStudentCourse = {
      slug,
      name: nameBySlug.get(slug) ?? slug,
      batchNo: toBatch(row.batchNo),
      status,
    };

    const current = bySlug.get(slug);
    if (!current) {
      bySlug.set(slug, candidate);
      continue;
    }

    const candidateRunning = candidate.status === "running";
    const currentRunning = current.status === "running";
    if (candidateRunning !== currentRunning) {
      if (candidateRunning) bySlug.set(slug, candidate);
      continue;
    }
    if (candidate.batchNo > current.batchNo) bySlug.set(slug, candidate);
  }

  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
}
