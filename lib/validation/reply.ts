import { z } from "zod";

import { objectIdSchema, videoLinksSchema } from "./common";

export const supportReplyInputSchema = z.strictObject({
  issueId: objectIdSchema,
  body: z.string().trim().min(1).max(20_000),
  videoLinks: videoLinksSchema,
});

export type SupportReplyInput = z.infer<typeof supportReplyInputSchema>;
