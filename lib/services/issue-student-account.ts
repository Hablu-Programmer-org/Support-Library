import "server-only";

import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";
import { normalizeEmail } from "@/lib/email";
import { findLmsUserByEmail } from "@/lib/lms";
import { SupportIssueModel, UserModel } from "@/models";

export type IssueStudentAccount = {
  /** The recorded email, else the filing student's account email. */
  email: string | null;
  /** Profile photo from the student's account; initials when null. */
  image: string | null;
};

/**
 * Identity extras for the Student snapshot on the staff case page (staff only).
 *
 * The issue stores no photo, so it comes from the student's account: the
 * support-library user with the recorded email, else the LMS user with that
 * email. When no email can be read (none recorded, or an envelope this
 * environment's key cannot decrypt), the filer's own account is used, but only
 * when the filer is a student: a staff-created case never borrows the staff
 * member's identity. Read-only and best-effort: any failure returns what is known.
 */
export async function getIssueStudentAccount(
  issueId: string,
  studentEmail: string | null | undefined,
): Promise<IssueStudentAccount> {
  const email = normalizeEmail(studentEmail) || null;
  try {
    await dbConnect();

    if (email) {
      const user = await UserModel.findOne({ email }).select("image").lean();
      if (typeof user?.image === "string" && user.image) return { email, image: user.image };
      const lmsUser = await findLmsUserByEmail(email).catch(() => null);
      return { email, image: lmsUser?.image ?? null };
    }

    if (!mongoose.isValidObjectId(issueId)) return { email: null, image: null };
    const issue = await SupportIssueModel.findById(issueId).select("createdBy").lean();
    if (!issue?.createdBy) return { email: null, image: null };
    const filer = await UserModel.findOne({ _id: issue.createdBy, role: "STUDENT" })
      .select("email image")
      .lean();
    return {
      email: typeof filer?.email === "string" && filer.email ? normalizeEmail(filer.email) : null,
      image: typeof filer?.image === "string" && filer.image ? filer.image : null,
    };
  } catch {
    return { email, image: null };
  }
}
