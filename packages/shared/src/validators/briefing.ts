import { z } from "zod";

export const generateBriefingSchema = z.object({
  forceRegenerate: z.boolean().optional().default(false),
});
export type GenerateBriefing = z.infer<typeof generateBriefingSchema>;
