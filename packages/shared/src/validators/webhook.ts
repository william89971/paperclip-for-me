import { z } from "zod";
import { WEBHOOK_TARGET_TYPES } from "../constants.js";

const configSizeLimit = z.record(z.unknown()).refine(
  (val) => JSON.stringify(val).length <= 10_000,
  { message: "Config too large (max 10KB)" },
);

export const createWebhookEndpointSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/i, "Slug must be alphanumeric, hyphens, or underscores"),
  targetType: z.enum(WEBHOOK_TARGET_TYPES),
  targetConfig: configSizeLimit.optional().default({}),
  enabled: z.boolean().optional().default(true),
});
export type CreateWebhookEndpoint = z.infer<typeof createWebhookEndpointSchema>;

export const updateWebhookEndpointSchema = createWebhookEndpointSchema.partial();
export type UpdateWebhookEndpoint = z.infer<typeof updateWebhookEndpointSchema>;
