import { z } from "zod";

import { objectIdSchema } from "./common";

export const caseSolutionLinkInputSchema = z
  .object({
    caseId: objectIdSchema,
    solutionArticleId: objectIdSchema,
  })
  .strict();

export type CaseSolutionLinkInput = z.infer<typeof caseSolutionLinkInputSchema>;
