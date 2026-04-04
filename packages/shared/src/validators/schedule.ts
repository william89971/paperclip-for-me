import { z } from "zod";
import { CronExpressionParser } from "cron-parser";

const metadataSizeLimit = z.record(z.unknown()).optional().nullable().refine(
  (val) => !val || JSON.stringify(val).length <= 10_000,
  { message: "Metadata too large (max 10KB)" },
);

export const createScheduleSchema = z.object({
  cronExpression: z.string().min(1).max(100).refine((val) => {
    try {
      CronExpressionParser.parse(val.trim());
      return true;
    } catch {
      return false;
    }
  }, { message: "Invalid cron expression" }),
  timezone: z.string().max(100).refine((tz) => {
    try { Intl.DateTimeFormat(undefined, { timeZone: tz }); return true; } catch { return false; }
  }, { message: "Invalid timezone" }).optional().default("UTC"),
  enabled: z.boolean().optional().default(true),
  label: z.string().max(200).optional().nullable(),
  metadata: metadataSizeLimit,
});
export type CreateSchedule = z.infer<typeof createScheduleSchema>;

export const updateScheduleSchema = createScheduleSchema.partial();
export type UpdateSchedule = z.infer<typeof updateScheduleSchema>;
