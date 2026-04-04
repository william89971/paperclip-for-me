import { z } from "zod";

const metadataSizeLimit = z.record(z.unknown()).optional().nullable().refine(
  (val) => !val || JSON.stringify(val).length <= 10_000,
  { message: "Metadata too large (max 10KB)" },
);

export const sendMessageSchema = z.object({
  fromAgentId: z.string().uuid(),
  toAgentId: z.string().uuid(),
  subject: z.string().max(500).optional().nullable(),
  body: z.string().min(1).max(50_000),
  metadata: metadataSizeLimit,
  replyToId: z.string().uuid().optional().nullable(),
});
export type SendMessage = z.infer<typeof sendMessageSchema>;
