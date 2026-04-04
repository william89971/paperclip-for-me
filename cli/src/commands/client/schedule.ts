import { Command } from "commander";
import type { AgentSchedule } from "@paperclipai/shared";
import {
  addCommonClientOptions,
  formatInlineRecord,
  handleCommandError,
  printOutput,
  resolveCommandContext,
  type BaseClientOptions,
} from "./common.js";

interface ScheduleListOptions extends BaseClientOptions {
  agentId: string;
}

interface ScheduleCreateOptions extends BaseClientOptions {
  agentId: string;
  cron: string;
  label?: string;
  timezone?: string;
}

interface ScheduleUpdateOptions extends BaseClientOptions {
  cron?: string;
  enabled?: string;
  label?: string;
}

interface ScheduleDeleteOptions extends BaseClientOptions {}

export function registerScheduleCommands(program: Command): void {
  const schedule = program.command("schedule").description("Schedule operations");

  addCommonClientOptions(
    schedule
      .command("list")
      .description("List schedules for an agent")
      .requiredOption("--agent-id <id>", "Agent ID")
      .action(async (opts: ScheduleListOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const rows =
            (await ctx.api.get<AgentSchedule[]>(
              `/api/agents/${opts.agentId}/schedules`,
            )) ?? [];

          if (ctx.json) {
            printOutput(rows, { json: true });
            return;
          }

          if (rows.length === 0) {
            printOutput([], { json: false });
            return;
          }

          for (const row of rows) {
            console.log(
              formatInlineRecord({
                id: row.id,
                label: row.label,
                cronExpression: row.cronExpression,
                enabled: row.enabled,
                nextRunAt: row.nextRunAt,
              }),
            );
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  addCommonClientOptions(
    schedule
      .command("create")
      .description("Create a schedule for an agent")
      .requiredOption("--agent-id <id>", "Agent ID")
      .requiredOption("--cron <expression>", "Cron expression")
      .option("--label <label>", "Schedule label")
      .option("--timezone <tz>", "Timezone (default: UTC)")
      .action(async (opts: ScheduleCreateOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const body: Record<string, unknown> = {
            cronExpression: opts.cron,
          };
          if (opts.label) body.label = opts.label;
          if (opts.timezone) body.timezone = opts.timezone;

          const created = await ctx.api.post<AgentSchedule>(
            `/api/agents/${opts.agentId}/schedules`,
            body,
          );
          printOutput(created, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  addCommonClientOptions(
    schedule
      .command("update")
      .description("Update a schedule")
      .argument("<scheduleId>", "Schedule ID")
      .option("--cron <expression>", "Cron expression")
      .option("--enabled <bool>", "Enable or disable the schedule")
      .option("--label <label>", "Schedule label")
      .action(async (scheduleId: string, opts: ScheduleUpdateOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const body: Record<string, unknown> = {};
          if (opts.cron !== undefined) body.cronExpression = opts.cron;
          if (opts.enabled !== undefined) body.enabled = opts.enabled === "true";
          if (opts.label !== undefined) body.label = opts.label;

          const updated = await ctx.api.patch<AgentSchedule>(
            `/api/schedules/${scheduleId}`,
            body,
          );
          printOutput(updated, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  addCommonClientOptions(
    schedule
      .command("delete")
      .description("Delete a schedule")
      .argument("<scheduleId>", "Schedule ID")
      .action(async (scheduleId: string, opts: ScheduleDeleteOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const removed = await ctx.api.delete<AgentSchedule>(
            `/api/schedules/${scheduleId}`,
          );
          printOutput(removed, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );
}
