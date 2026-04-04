import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const agentMessages = pgTable(
  "agent_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    fromAgentId: uuid("from_agent_id").notNull().references(() => agents.id),
    toAgentId: uuid("to_agent_id").notNull().references(() => agents.id),
    subject: text("subject"),
    body: text("body").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    readAt: timestamp("read_at", { withTimezone: true }),
    replyToId: uuid("reply_to_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyToAgentIdx: index("agent_messages_company_to_agent_idx").on(table.companyId, table.toAgentId),
    companyFromAgentIdx: index("agent_messages_company_from_agent_idx").on(table.companyId, table.fromAgentId),
    replyToIdx: index("agent_messages_reply_to_idx").on(table.replyToId),
  }),
);
