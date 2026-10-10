import { z } from "zod";

import { CASE_PRIORITIES, CASE_STATUSES } from "@/models/shared";
import { objectIdSchema, optionalSlugSchema, tagsSchema } from "./common";

export const supportIssueInputSchema = z.strictObject({
  studentName: z.string().trim().min(2).max(120),
  studentEmail: z.string().trim().toLowerCase().email().max(160),
  lmsUserId: z.string().trim().max(64).optional(),
  title: z.string().trim().min(5).max(200),
  question: z.string().trim().min(5).max(20_000),
  courseSlug: optionalSlugSchema,
  batchNo: z.coerce.number().int().min(1).max(9999).optional(),
  moduleSlug: optionalSlugSchema,
  contentSlug: optionalSlugSchema,
  status: z.enum(CASE_STATUSES).default("OPEN"),
  priority: z.enum(CASE_PRIORITIES).default("NORMAL"),
  tags: tagsSchema,
  mentorId: objectIdSchema.optional(),
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
  sort: z.enum(["newest", "oldest", "priority"]).optional(),
});

export type SupportIssueInput = z.infer<typeof supportIssueInputSchema>;
export type SupportIssueFilter = z.infer<typeof supportIssueFilterSchema>;