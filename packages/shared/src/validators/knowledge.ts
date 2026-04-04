import { z } from "zod";

export const createKnowledgeEntrySchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(100_000),
  category: z.string().max(200).optional().nullable(),
  tags: z.array(z.string().max(100)).max(50).optional().nullable(),
});
export type CreateKnowledgeEntry = z.infer<typeof createKnowledgeEntrySchema>;

export const updateKnowledgeEntrySchema = createKnowledgeEntrySchema.partial();
export type UpdateKnowledgeEntry = z.infer<typeof updateKnowledgeEntrySchema>;
