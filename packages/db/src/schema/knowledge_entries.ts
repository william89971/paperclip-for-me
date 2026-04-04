import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const knowledgeEntries = pgTable(
  "knowledge_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    title: text("title").notNull(),
    content: text("content").notNull(),
    category: text("category"),
    tags: text("tags").array(),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id),
    updatedByAgentId: uuid("updated_by_agent_id").references(() => agents.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("knowledge_entries_company_idx").on(table.companyId),
    companyCategoryIdx: index("knowledge_entries_company_category_idx").on(table.companyId, table.category),
  }),
);
