import { z } from "zod";

import { CASE_PRIORITIES, CASE_STATUSES } from "@/models/shared";
import { objectIdSchema, optionalSlugSchema, tagsSchema } from "./common";

export const supportCaseInputSchema = z
  .object({
    studentRefId: objectIdSchema,
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
  })
  .strict();

export const supportCaseFilterSchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    status: z.enum(CASE_STATUSES).optional(),
    courseSlug: optionalSlugSchema,
    batchNo: z.coerce.number().int().min(1).max(9999).optional(),
    tag: z.string().trim().max(32).optional(),
    mentorId: objectIdSchema.optional(),
    studentRefId: objectIdSchema.optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  })
  .strict();

export type SupportCaseInput = z.infer<typeof supportCaseInputSchema>;
export type SupportCaseFilter = z.infer<typeof supportCaseFilterSchema>;
