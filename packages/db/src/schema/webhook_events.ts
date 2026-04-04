import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { webhookEndpoints } from "./webhook_endpoints.js";

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    endpointId: uuid("endpoint_id").notNull().references(() => webhookEndpoints.id),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    headers: jsonb("headers").$type<Record<string, string>>(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    status: text("status").notNull().default("received"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    resultEntityId: text("result_entity_id"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    endpointCreatedIdx: index("webhook_events_endpoint_created_idx").on(table.endpointId, table.createdAt),
    companyCreatedIdx: index("webhook_events_company_created_idx").on(table.companyId, table.createdAt),
  }),
);
