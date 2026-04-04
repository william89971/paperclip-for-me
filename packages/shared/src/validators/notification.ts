import { z } from "zod";
import { NOTIFICATION_CHANNEL_TYPES } from "../constants.js";

const configSizeLimit = z.record(z.unknown()).refine(
  (val) => JSON.stringify(val).length <= 10_000,
  { message: "Config too large (max 10KB)" },
);

export const createNotificationChannelSchema = z.object({
  type: z.enum(NOTIFICATION_CHANNEL_TYPES),
  name: z.string().max(200).optional().nullable(),
  config: configSizeLimit.default({}),
  enabled: z.boolean().optional().default(true),
});
export type CreateNotificationChannel = z.infer<typeof createNotificationChannelSchema>;

export const updateNotificationChannelSchema = createNotificationChannelSchema.partial();
export type UpdateNotificationChannel = z.infer<typeof updateNotificationChannelSchema>;

export const createNotificationRuleSchema = z.object({
  channelId: z.string().uuid(),
  eventPattern: z.string().min(1).max(255),
  filter: z.record(z.unknown()).optional().nullable().refine(
    (val) => !val || JSON.stringify(val).length <= 10_000,
    { message: "Filter too large (max 10KB)" },
  ),
  enabled: z.boolean().optional().default(true),
});
export type CreateNotificationRule = z.infer<typeof createNotificationRuleSchema>;

export const updateNotificationRuleSchema = createNotificationRuleSchema.partial();
export type UpdateNotificationRule = z.infer<typeof updateNotificationRuleSchema>;
