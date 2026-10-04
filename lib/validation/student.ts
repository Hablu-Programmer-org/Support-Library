import { z } from "zod";

export const studentRefInputSchema = z
  .object({
    lmsUserId: z.string().trim().max(64).optional(),
    studentId: z.string().trim().regex(/^[A-Za-z0-9-]{2,32}$/).optional(),
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().optional(),
    phone: z.string().trim().regex(/^[+0-9 ()-]{6,20}$/).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict();

export type StudentRefInput = z.infer<typeof studentRefInputSchema>;
