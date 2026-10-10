import { z } from "zod";

import { fileLinksSchema, objectIdSchema, videoLinksSchema } from "./common";

export const supportReplyInputSchema = z.strictObject({
  issueId: objectIdSchema,
  body: z.string().trim().min(1).max(20_000),
  isInternalNote: z.boolean().default(false),
  fileLinks: fileLinksSchema,
  videoLinks: videoLinksSchema,
});

export type SupportReplyInput = z.infer<typeof supportReplyInputSchema>;