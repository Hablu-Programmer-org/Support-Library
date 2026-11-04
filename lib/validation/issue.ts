import { z } from "zod";

import {
  ISSUE_DETAILS_CREATE_MIN,
  ISSUE_DETAILS_MAX,
  ISSUE_TITLE_CREATE_MAX,
} from "@/lib/constants";
import { hasEnoughIssueDetails } from "@/lib/issue-content-rules";
import { CASE_PRIORITIES, CASE_STATUSES } from "@/models/shared";
import {
  objectIdSchema,
  optionalSlugSchema,
  tagsSchema,
  videoLinksSchema,
} from "./common";

export const supportIssueInputSchema = z.strictObject({
  studentName: z.string().trim().min(2).max(120).optional(),
  studentEmail: z.string().trim().toLowerCase().email().max(160).optional(),
  lmsUserId: z.string().trim().max(64).optional(),
  title: z.string().trim().min(5).max(200),
  question: z.string().trim().min(5).max(20_000),
  videoLinks: videoLinksSchema,
  courseSlug: optionalSlugSchema,
  batchNo: z.coerce.number().int().min(1).max(9999).optional(),
  moduleSlug: optionalSlugSchema,
  contentSlug: optionalSlugSchema,
  status: z.enum(CASE_STATUSES).default("OPEN"),
  priority: z.enum(CASE_PRIORITIES).default("NORMAL"),
  tags: tagsSchema,
  mentorId: objectIdSchema.optional(),
}).superRefine((issue, ctx) => {
  if (Boolean(issue.studentName) !== Boolean(issue.studentEmail)) {
    const path = issue.studentName ? ["studentEmail"] : ["studentName"];
    ctx.addIssue({
      code: "custom",
      path,
      message: "Provide both student name and email, or leave both empty",
    });
  }
  if (issue.lmsUserId && !issue.studentEmail) {
    ctx.addIssue({
      code: "custom",
      path: ["lmsUserId"],
      message: "LMS user id requires a student identity",
    });
  }
});

/**
 * The create-only title contract.
 *
 * A new issue is read as "the problem", so its title is capped at 80 characters
 * and must stay on one line. Editing keeps the wider 200-character limit in
 * `supportIssueInputSchema` so rows written before this rule stay editable.
 */
export const createSupportIssueInputSchema = supportIssueInputSchema.safeExtend({
  title: z
    .string()
    .trim()
    .min(5)
    .max(
      ISSUE_TITLE_CREATE_MAX,
      `Keep the title to ${ISSUE_TITLE_CREATE_MAX} characters or fewer`,
    )
    .regex(/^[^\r\n]+$/, "Keep the title on one line"),
  question: z
    .string()
    .trim()
    .max(ISSUE_DETAILS_MAX)
    .refine(
      hasEnoughIssueDetails,
      `Please add at least ${ISSUE_DETAILS_CREATE_MIN} characters so the support team can understand the issue`,
    ),
});

export const supportIssueFilterSchema = z.strictObject({
  q: z.string().trim().max(200).optional(),
  status: z.enum(CASE_STATUSES).optional(),
  courseSlug: optionalSlugSchema,
  batchNo: z.coerce.number().int().min(1).max(9999).optional(),
  tag: z.string().trim().max(32).optional(),
  mentorId: objectIdSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sort: z.enum(["answer", "newest", "oldest", "priority"]).optional(),
});

export type SupportIssueInput = z.infer<typeof supportIssueInputSchema>;
export type SupportIssueFilter = z.infer<typeof supportIssueFilterSchema>;
