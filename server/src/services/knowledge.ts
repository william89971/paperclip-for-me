import { and, eq, ilike, or, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { knowledgeEntries } from "@paperclipai/db";

export function knowledgeService(db: Db) {
  return {
    list: (companyId: string, category?: string) => {
      const conditions = [eq(knowledgeEntries.companyId, companyId)];
      if (category) {
        conditions.push(eq(knowledgeEntries.category, category));
      }
      return db
        .select()
        .from(knowledgeEntries)
        .where(and(...conditions))
        .orderBy(desc(knowledgeEntries.updatedAt));
    },

    getById: (id: string) =>
      db
        .select()
        .from(knowledgeEntries)
        .where(eq(knowledgeEntries.id, id))
        .then((rows) => rows[0] ?? null),

    create: (
      companyId: string,
      data: { title: string; content: string; category?: string | null; tags?: string[] | null },
      actorAgentId?: string,
    ) =>
      db
        .insert(knowledgeEntries)
        .values({
          companyId,
          title: data.title,
          content: data.content,
          category: data.category ?? null,
          tags: data.tags ?? null,
          createdByAgentId: actorAgentId ?? null,
        })
        .returning()
        .then((rows) => rows[0]),

    update: (
      id: string,
      data: Partial<{ title: string; content: string; category: string | null; tags: string[] | null }>,
      actorAgentId?: string,
    ) =>
      db
        .update(knowledgeEntries)
        .set({
          ...data,
          updatedByAgentId: actorAgentId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(knowledgeEntries.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    remove: (id: string) =>
      db
        .delete(knowledgeEntries)
        .where(eq(knowledgeEntries.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    search: (companyId: string, query: string) => {
      const pattern = `%${query}%`;
      return db
        .select()
        .from(knowledgeEntries)
        .where(
          and(
            eq(knowledgeEntries.companyId, companyId),
            or(
              ilike(knowledgeEntries.title, pattern),
              ilike(knowledgeEntries.content, pattern),
            ),
          ),
        )
        .orderBy(desc(knowledgeEntries.updatedAt))
        .limit(50);
    },
  };
}
