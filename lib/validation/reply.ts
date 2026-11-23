import { z } from "zod";

import { REPLY_BODY_MAX } from "@/lib/constants";

import { objectIdSchema } from "./common";

export const supportReplyInputSchema = z.strictObject({
  issueId: objectIdSchema,
  body: z.string().trim().min(1).max(REPLY_BODY_MAX),
});

// Existing schema is intentionally reused for students: same content limits,
// different authorization and lifecycle handling in the action/service layers.
export const studentReplyInputSchema = supportReplyInputSchema;

export type SupportReplyInput = z.infer<typeof supportReplyInputSchema>;
