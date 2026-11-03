import { z } from "zod";

import { objectIdSchema, videoLinksSchema } from "./common";

export const supportReplyInputSchema = z.strictObject({
  issueId: objectIdSchema,
  body: z.string().trim().min(1).max(20_000),
  videoLinks: videoLinksSchema,
});

// Existing schema is intentionally reused for students: same content limits,
// different authorization and lifecycle handling in the action/service layers.
export const studentReplyInputSchema = supportReplyInputSchema;

export type SupportReplyInput = z.infer<typeof supportReplyInputSchema>;
