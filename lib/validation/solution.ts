import { z } from "zod";

import { SOLUTION_VISIBILITIES } from "@/models/shared";
import { fileLinksSchema, slugSchema, tagsSchema, videoLinksSchema } from "./common";

export const solutionArticleInputSchema = z
  .object({
    title: z.string().trim().min(5).max(200),
    slug: slugSchema.optional(),
    summary: z.string().trim().min(5).max(500),
    body: z.string().trim().min(10).max(100_000),
    tags: tagsSchema,
    visibility: z.enum(SOLUTION_VISIBILITIES).default("INTERNAL"),
    fileLinks: fileLinksSchema,
    videoLinks: videoLinksSchema,
  })
  .strict();

export type SolutionArticleInput = z.infer<typeof solutionArticleInputSchema>;
