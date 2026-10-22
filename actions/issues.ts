"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import mongoose from "mongoose";

import { assertRole } from "@/lib/auth-guard";
import { findLmsUserByEmail, listStudentCourses } from "@/lib/lms";
import { normalizeEmail } from "@/lib/email";
import { operationIdSchema } from "@/lib/mutation-security";
import { parseVideoLinks } from "@/lib/parse-links";
import { shouldPublishOnSolve } from "@/lib/issue-publication";
import { consumeRateLimit } from "@/lib/services/rate-limit";
import {
  changeIssueStatus,
  createIssue,
  publishIssue,
  softDeleteIssue,
  unpublishIssue,
  updateIssue,
} from "@/lib/services/issues";
import { getStaffUserById } from "@/lib/services/staff";
import {
  supportIssueInputSchema,
  supportReplyInputSchema,
  type SupportIssueInput,
} from "@/lib/validation";
import {
  discardUploads,
  formFiles,
  ingestUploads,
  UploadValidationError,
  type IngestedUpload,
} from "@/lib/uploads/ingest";
import { CASE_STATUSES, type CaseStatus } from "@/models";
import { withCsrfProtection } from "@/lib/safe-action";

export type FormState = {
  fieldErrors?: Record<string, string[] | undefined>;
  message?: string;
};

const formValue = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

const parseTags = (value?: string) =>
  value
    ?.split(",")
    .map((tag) => tag.trim())
    .filter(Boolean) ?? [];

const initialReplySchema = supportReplyInputSchema.omit({ issueId: true });
const revisionSchema = z.string().datetime();

/** Shown when the student typed something that yielded no parseable link. */
const VIDEO_LINKS_HINT =
  "Use one link per line: Title|https://youtu.be/videoId (optionally add |01:30 and a summary)";

const zodFieldErrors = (
  error: z.ZodError,
  fieldNames: Record<string, string> = {},
) => {
  const fieldErrors: Record<string, string[]> = {};
  error.issues.forEach((issue) => {
    const root = String(issue.path[0] ?? "_form");
    const path = fieldNames[root] ?? root;
    fieldErrors[path] = [...(fieldErrors[path] ?? []), issue.message];
  });
  return fieldErrors;
};

const parseIssueForm = (formData: FormData) =>
  supportIssueInputSchema.parse({
    studentName: formValue(formData, "studentName"),
    studentEmail: formValue(formData, "studentEmail"),
    lmsUserId: formValue(formData, "lmsUserId"),
    title: formValue(formData, "title"),
    question: formValue(formData, "question"),
    status: formValue(formData, "status") ?? "OPEN",
    priority: formValue(formData, "priority") ?? "NORMAL",
    courseSlug: formValue(formData, "courseSlug"),
    batchNo: formValue(formData, "batchNo"),
    moduleSlug: formValue(formData, "moduleSlug"),
    contentSlug: formValue(formData, "contentSlug"),
    tags: parseTags(formValue(formData, "tags")),
    videoLinks: parseVideoLinks(formValue(formData, "videoLinks")),
  });

async function bindLmsIdentity(issueData: z.infer<typeof supportIssueInputSchema>) {
  if (!issueData.studentEmail) {
    return { ...issueData, lmsUserId: undefined };
  }
  const lmsUser = await findLmsUserByEmail(issueData.studentEmail);
  if (issueData.lmsUserId && issueData.lmsUserId !== lmsUser?.userId) {
    throw new Error("LMS_IDENTITY_MISMATCH");
  }
  return { ...issueData, lmsUserId: lmsUser?.userId };
}

export async function createIssueAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  return withCsrfProtection(formData, async (formData) => {
    const guard = await assertRole("ADMIN", "MENTOR");
    if (!guard.ok) return { fieldErrors: { _form: ["Unauthorized"] } };

    let issueData;
    let operationId: string;
    try {
      issueData = await bindLmsIdentity(parseIssueForm(formData));
      operationId = operationIdSchema.parse(formData.get("operationId"));
    } catch (err) {
      if (err instanceof Error && err.message === "LMS_IDENTITY_MISMATCH") {
        return { fieldErrors: { studentEmail: ["The selected LMS user does not match this email"] } };
      }
      if (err instanceof z.ZodError) {
        return { fieldErrors: zodFieldErrors(err) };
      }
      return { fieldErrors: { _form: ["Invalid form data"] } };
    }

    const solutionBody = formValue(formData, "solutionBody");
    const solutionVideoLinks = parseVideoLinks(formValue(formData, "solutionVideoLinks"));
    const solveIssue = formData.get("solveIssue") === "on";

    // Read the file inputs up front: they decide whether the answer section was
    // filled in at all, and whether the upload budget needs to be charged.
    const issueFiles = formFiles(formData, "uploads");
    const solutionFiles = formFiles(formData, "solutionUploads");

    const hasSolution = Boolean(
      solutionBody ||
        solutionVideoLinks.length ||
        solutionFiles.length,
    );
    let solution: z.infer<typeof initialReplySchema> | null;
    try {
      solution = hasSolution
        ? initialReplySchema.parse({
            body: solutionBody ?? "See the attached images or video links for the answer.",
            videoLinks: solutionVideoLinks,
          })
        : null;
    } catch (err) {
      if (err instanceof z.ZodError) {
        return {
          fieldErrors: zodFieldErrors(err, {
            body: "solutionBody",
            videoLinks: "solutionVideoLinks",
          }),
        };
      }
      return { fieldErrors: { _form: ["Invalid answer data"] } };
    }

    try {
      await consumeRateLimit("issue.create", guard.session.user.id);
      if (issueFiles.length || solutionFiles.length) {
        await consumeRateLimit("attachment.upload", guard.session.user.id);
      }
    } catch {
      return { fieldErrors: { _form: ["Too many submissions. Please wait a moment and try again."] } };
    }

    // Bytes are stored before the document is written, so a failed write has to
    // clean up after itself. `createIssue` discards these objects when the
    // operation id is replayed or the write loses a race; anything that fails
    // before it is reached is discarded here.
    let issueUploads: IngestedUpload[] = [];
    let solutionUploads: IngestedUpload[] = [];
    try {
      issueUploads = await ingestUploads(issueFiles, guard.session.user.id);
      solutionUploads = await ingestUploads(solutionFiles, guard.session.user.id, "solutionUploads");
    } catch (err) {
      await discardUploads([...issueUploads, ...solutionUploads]);
      if (err instanceof UploadValidationError) {
        return { fieldErrors: { [err.field]: [err.message] } };
      }
      return { fieldErrors: { _form: ["Unable to attach the selected files. Please try again later."] } };
    }

    let supportIssue;
    try {
      supportIssue = await createIssue(
        { ...issueData, status: "OPEN" },
        guard.session.user.id,
        guard.session.user.role as "ADMIN" | "MENTOR",
        operationId,
        solution,
        solveIssue,
        issueUploads,
        solutionUploads,
      );
    } catch {
      return { fieldErrors: { _form: ["Unable to create the issue. Please try again later."] } };
    }

    revalidatePath("/dashboard/issues");
    revalidatePath("/dashboard");
    redirect(`/dashboard/issues/${supportIssue.id}`);
  });
}

/**
 * Student self-service: submit an issue.
 *
 * The student's identity is derived from the session and the LMS lookup, never
 * from the form, so nobody can raise a case on another student's behalf. The
 * case is always created OPEN/INTERNAL with no mentor and no initial answer, and
 * the submitter is sent to a confirmation page instead of the internal view.
 */
export async function createStudentIssueAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  return withCsrfProtection(formData, async (formData) => {
    // Exact role, not the rank-based guard: this path always produces a
    // student-owned, mentor-less case, so it must not be reachable by staff.
    const guard = await assertRole("STUDENT");
    if (!guard.ok || guard.session.user.role !== "STUDENT") {
      return { fieldErrors: { _form: ["Unauthorized"] } };
    }

    const email = normalizeEmail(guard.session.user.email ?? "");
    if (!email) {
      return {
        fieldErrors: {
          _form: ["Your account has no email address. Please contact the support team."],
        },
      };
    }

    const profile = await getStaffUserById(guard.session.user.id);
    if (!profile) {
      return {
        fieldErrors: { _form: ["Your account could not be found. Please sign in again."] },
      };
    }

    let operationId: string;
    try {
      operationId = operationIdSchema.parse(formData.get("operationId"));
    } catch {
      return {
        fieldErrors: {
          _form: ["This submission could not be verified. Reload the page and try again."],
        },
      };
    }

    let issueData: SupportIssueInput;
    try {
      // Name and email come from our own records, never the form, so they only
      // need clamping to the schema limits — a long LMS display name must not
      // fail validation with an error the student has no field to fix.
      const profileName = profile.name.trim();
      const studentName = (profileName.length >= 2 ? profileName : email).slice(0, 120);

      const rawVideoLinks = formValue(formData, "videoLinks");
      const videoLinks = parseVideoLinks(rawVideoLinks);
      if (rawVideoLinks && videoLinks.length === 0) {
        return { fieldErrors: { videoLinks: [VIDEO_LINKS_HINT] } };
      }

      const lmsUser = await findLmsUserByEmail(email);
      // The course (and therefore the batch) comes from the student's LMS
      // enrolments, never from the form: a crafted POST cannot claim another
      // course or batch.
      const courses = await listStudentCourses(email);
      let courseSlug: string | undefined;
      let batchNo: number | undefined;

      if (courses.length > 0) {
        const chosen = formValue(formData, "courseSlug");
        const enrolled = courses.find((course) => course.slug === chosen);
        if (!enrolled) {
          return {
            fieldErrors: {
              courseSlug: ["Select the course this problem is about."],
            },
          };
        }
        courseSlug = enrolled.slug;
        batchNo = enrolled.batchNo > 0 ? enrolled.batchNo : undefined;
      }

      issueData = supportIssueInputSchema.parse({
        studentName,
        studentEmail: email,
        lmsUserId: lmsUser?.userId,
        title: formValue(formData, "title"),
        question: formValue(formData, "question"),
        courseSlug,
        batchNo,
        moduleSlug: formValue(formData, "moduleSlug"),
        contentSlug: formValue(formData, "contentSlug"),
        videoLinks,
        status: "OPEN",
        priority: "NORMAL",
        tags: parseTags(formValue(formData, "tags")),
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors = zodFieldErrors(err);
        if (
          fieldErrors.title ||
          fieldErrors.question ||
          fieldErrors.videoLinks ||
          fieldErrors.courseSlug ||
          fieldErrors.batchNo ||
          fieldErrors.moduleSlug ||
          fieldErrors.contentSlug ||
          fieldErrors.tags
        ) {
          return {
            fieldErrors: {
              title: fieldErrors.title,
              question: fieldErrors.question,
              videoLinks: fieldErrors.videoLinks,
              courseSlug: fieldErrors.courseSlug,
              batchNo: fieldErrors.batchNo,
              moduleSlug: fieldErrors.moduleSlug,
              contentSlug: fieldErrors.contentSlug,
              tags: fieldErrors.tags,
            },
          };
        }
        return { fieldErrors: { _form: ["Invalid form data"] } };
      }
      // Includes LMS lookup/connection failures, so keep it generic.
      return { fieldErrors: { _form: ["Unable to submit the issue. Please try again later."] } };
    }

    // Attachments the student picked for this submission. The filenames are never
    // added to the search index: they routinely contain a person's name, which
    // would turn a previously private value into something searchable.
    const studentFiles = formFiles(formData, "uploads");

    try {
      await consumeRateLimit("issue.create.student", guard.session.user.id);
      if (studentFiles.length) {
        await consumeRateLimit("attachment.upload", guard.session.user.id);
      }
    } catch {
      return {
        fieldErrors: {
          _form: ["Too many submissions. Please wait a few minutes and try again."],
        },
      };
    }

    let uploads: IngestedUpload[] = [];
    try {
      uploads = await ingestUploads(studentFiles, guard.session.user.id);
    } catch (err) {
      if (err instanceof UploadValidationError) {
        return { fieldErrors: { [err.field]: [err.message] } };
      }
      return { fieldErrors: { _form: ["Unable to attach the selected files. Please try again later."] } };
    }

    let createdIssue: { id: string };
    try {
      createdIssue = await createIssue(
        issueData,
        guard.session.user.id,
        "STUDENT",
        operationId,
        null,
        false,
        uploads,
      );
    } catch {
      return { fieldErrors: { _form: ["Unable to submit the issue. Please try again later."] } };
    }

    revalidatePath("/dashboard/issues");
    revalidatePath("/dashboard/my-requests");
    revalidatePath("/dashboard");
    // The student lands on their own request, which is where the live support
    // panel for this request lives (and where the team's replies appear).
    redirect(`/dashboard/issues/${createdIssue.id}?created=1`);
  });
}

export async function updateIssueAction(id: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  return withCsrfProtection(formData, async (formData) => {
    const guard = await assertRole("ADMIN", "MENTOR");
    if (!guard.ok) return { fieldErrors: { _form: ["Unauthorized"] } };

    let issueData;
    try {
      issueData = await bindLmsIdentity(parseIssueForm(formData));
    } catch (err) {
      if (err instanceof Error && err.message === "LMS_IDENTITY_MISMATCH") {
        return { fieldErrors: { studentEmail: ["The selected LMS user does not match this email"] } };
      }
      if (err instanceof z.ZodError) {
        return { fieldErrors: zodFieldErrors(err) };
      }
      return { fieldErrors: { _form: ["Invalid form data"] } };
    }

    // Archiving is a distinct stateful operation (soft delete + audit + publication
    // history). Editing must never be able to move an issue into ARCHIVED, or the
    // issue would be marked archived without being removed from active lists.
    if (issueData.status === "ARCHIVED") {
      return { fieldErrors: { status: ["Use the Archive issue action instead"] } };
    }

    const removeUploadIds = formData
      .getAll("removeUploadIds")
      .map(String)
      .filter((value) => mongoose.Types.ObjectId.isValid(value));
    const newFiles = formFiles(formData, "uploads");

    let newUploads: IngestedUpload[] = [];
    try {
      await consumeRateLimit("issue.update", guard.session.user.id);
      if (newFiles.length) await consumeRateLimit("attachment.upload", guard.session.user.id);
      newUploads = await ingestUploads(newFiles, guard.session.user.id);
    } catch (err) {
      if (err instanceof UploadValidationError) {
        return { fieldErrors: { [err.field]: [err.message] } };
      }
      return { fieldErrors: { _form: ["Unable to attach the selected files. Please try again later."] } };
    }

    let supportIssue;
    try {
      const expectedUpdatedAt = revisionSchema.parse(formData.get("expectedUpdatedAt"));
      supportIssue = await updateIssue(
        id,
        issueData,
        guard.session.user.id,
        guard.session.user.role as "ADMIN" | "MENTOR",
        new Date(expectedUpdatedAt),
        newUploads,
        removeUploadIds,
      );
    } catch {
      await discardUploads(newUploads);
      return { fieldErrors: { _form: ["Unable to update the issue. Please try again later."] } };
    }
    if (!supportIssue) {
      await discardUploads(newUploads);
      return { fieldErrors: { _form: ["Issue changed since you opened it. Refresh and try again."] } };
    }

    revalidatePath("/dashboard/issues");
    revalidatePath(`/dashboard/issues/${id}`);
    redirect(`/dashboard/issues/${id}`);
  });
}

export async function changeIssueStatusAction(id: string, _prevState: FormState | undefined, formData: FormData): Promise<FormState> {
  return withCsrfProtection(formData, async (formData) => {
    const guard = await assertRole("ADMIN", "MENTOR");
    if (!guard.ok) return { fieldErrors: { _form: ["Unauthorized"] } };

    const status = z.enum(CASE_STATUSES).parse(formData.get("status")) as CaseStatus;
    if (status === "ARCHIVED") {
      return { fieldErrors: { status: ["Use the Archive issue action instead"] } };
    }

    // Solving can publish straight away, but only through the same PII review
    // gate as the explicit publish form: admin role + the short confirmation.
    const publishOnSolve = shouldPublishOnSolve({
      status,
      role: guard.session.user.role ?? "STUDENT",
      confirmed: formData.get("publishConfirmed") === "true",
    });

    let supportIssue;
    try {
      await consumeRateLimit("issue.status", guard.session.user.id);
      if (publishOnSolve) {
        await consumeRateLimit("issue.publish", guard.session.user.id, {
          action: "ISSUE_PUBLISH",
          resourceType: "SupportIssue",
          resourceId: id,
        });
      }
      const expectedUpdatedAt = revisionSchema.parse(formData.get("expectedUpdatedAt"));
      supportIssue = await changeIssueStatus(id, status, guard.session.user.id, new Date(expectedUpdatedAt), {
        publish: publishOnSolve,
      });
    } catch {
      return { fieldErrors: { _form: ["Unable to update the status. Please try again later."] } };
    }
    if (!supportIssue) return { fieldErrors: { _form: ["Issue changed since you opened it. Refresh and try again."] } };
    revalidatePath("/dashboard/issues");
    revalidatePath(`/dashboard/issues/${id}`);
    return {
      message: publishOnSolve
        ? "Marked as solved and published to the library"
        : "Status updated",
    };
  });
}

// Backward-compatible wrapper for simple forms (status update, delete)
export async function changeIssueStatusActionSimple(id: string, formData: FormData) {
  const result = await changeIssueStatusAction(id, undefined, formData);
  if (result.fieldErrors) {
    // For simple forms, throw to trigger error boundary or redirect with error
    throw new Error(result.fieldErrors._form?.[0] ?? "Failed to update status");
  }
}

export async function deleteIssueAction(id: string, formData: FormData): Promise<FormState> {
  return withCsrfProtection(formData, async () => {
    const guard = await assertRole("ADMIN", "MENTOR");
    if (!guard.ok) return { fieldErrors: { _form: ["Unauthorized"] } };

    let supportIssue;
    try {
      await consumeRateLimit("issue.archive", guard.session.user.id, {
        action: "ISSUE_ARCHIVE",
        resourceType: "SupportIssue",
        resourceId: id,
      });
      supportIssue = await softDeleteIssue(id, guard.session.user.id);
    } catch {
      return { fieldErrors: { _form: ["Unable to archive the issue. Please try again later."] } };
    }
    if (!supportIssue) return { fieldErrors: { _form: ["Issue not found"] } };
    revalidatePath("/dashboard/issues");
    redirect("/dashboard/issues");
  });
}

// Backward-compatible wrapper for simple delete forms
export async function deleteIssueActionSimple(id: string, formData: FormData) {
  const result = await deleteIssueAction(id, formData);
  if (result.fieldErrors) {
    throw new Error(result.fieldErrors._form?.[0] ?? "Failed to delete issue");
  }
}

export async function publishIssueAction(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  return withCsrfProtection(formData, async (formData) => {
    const guard = await assertRole("ADMIN");
    if (!guard.ok) return { fieldErrors: { _form: ["Unauthorized"] } };

    const reviewedAt = formData.get("reviewedAt");
    const reviewConfirmed = formData.get("reviewConfirmed");

    if (reviewConfirmed !== "true") {
      return { fieldErrors: { reviewConfirmed: ["Please confirm you have reviewed the issue for student personal information"] } };
    }

    const parsedReviewedAt = z.string().datetime().safeParse(reviewedAt);
    if (!parsedReviewedAt.success) return { fieldErrors: { _form: ["Invalid issue revision"] } };

    let supportIssue;
    try {
      await consumeRateLimit("issue.publish", guard.session.user.id, {
        action: "ISSUE_PUBLISH",
        resourceType: "SupportIssue",
        resourceId: id,
      });
      supportIssue = await publishIssue(
        id,
        guard.session.user.id,
        new Date(parsedReviewedAt.data),
      );
    } catch {
      return { fieldErrors: { _form: ["Unable to publish the issue. Please try again later."] } };
    }
    if (!supportIssue) return { fieldErrors: { _form: ["Issue changed since review. Refresh and review it again."] } };

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/issues");
    revalidatePath(`/dashboard/issues/${id}`);
    redirect(`/dashboard/issues/${id}`);
  });
}

export async function unpublishIssueAction(id: string, formData: FormData) {
  return withCsrfProtection(formData, async (formData) => {
    const guard = await assertRole("ADMIN");
    if (!guard.ok) redirect("/unauthorized");

    let supportIssue;
    try {
      await consumeRateLimit("issue.unpublish", guard.session.user.id, {
        action: "ISSUE_UNPUBLISH",
        resourceType: "SupportIssue",
        resourceId: id,
      });
      const expectedUpdatedAt = revisionSchema.parse(formData.get("expectedUpdatedAt"));
      supportIssue = await unpublishIssue(id, guard.session.user.id, new Date(expectedUpdatedAt));
    } catch {
      throw new Error("Unable to unpublish the issue. Please try again later.");
    }
    if (!supportIssue) throw new Error("Issue changed since you opened it. Refresh and try again.");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/issues");
    revalidatePath(`/dashboard/issues/${id}`);
    redirect(`/dashboard/issues/${id}`);
  });
}
