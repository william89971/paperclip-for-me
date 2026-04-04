import { Command } from "commander";
import type { NotificationChannel, NotificationRule } from "@paperclipai/shared";
import {
  addCommonClientOptions,
  formatInlineRecord,
  handleCommandError,
  printOutput,
  resolveCommandContext,
  type BaseClientOptions,
} from "./common.js";

interface ChannelCreateOptions extends BaseClientOptions {
  type: string;
  name: string;
  config: string;
}

interface ChannelListOptions extends BaseClientOptions {}

interface ChannelDeleteOptions extends BaseClientOptions {}

interface RuleCreateOptions extends BaseClientOptions {
  channelId: string;
  eventPattern: string;
  filter?: string;
}

interface RuleListOptions extends BaseClientOptions {}

interface RuleDeleteOptions extends BaseClientOptions {}

export function registerNotificationCommands(program: Command): void {
  const notification = program.command("notification").description("Notification channel and rule operations");

  // ── Channel subcommands ─────────────────────────────────────

  const channel = notification.command("channel").description("Manage notification channels");

  addCommonClientOptions(
    channel
      .command("create")
      .description("Create a notification channel")
      .requiredOption("-C, --company-id <id>", "Company ID")
      .requiredOption("--type <type>", "Channel type (webhook, slack_webhook)")
      .requiredOption("--name <name>", "Channel name")
      .requiredOption("--config <json>", "Channel config as JSON string")
      .action(async (opts: ChannelCreateOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const companyId = opts.companyId;
          if (!companyId) {
            throw new Error("Company ID is required. Pass -C or --company-id.");
          }

          let config: Record<string, unknown>;
          try {
            config = JSON.parse(opts.config);
          } catch {
            throw new Error("Invalid JSON for --config");
          }

          const created = await ctx.api.post<NotificationChannel>(
            `/api/companies/${companyId}/notifications/channels`,
            {
              type: opts.type,
              name: opts.name,
              config,
            },
          );
          printOutput(created, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  addCommonClientOptions(
    channel
      .command("list")
      .description("List notification channels for a company")
      .requiredOption("-C, --company-id <id>", "Company ID")
      .action(async (opts: ChannelListOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const companyId = opts.companyId;
          if (!companyId) {
            throw new Error("Company ID is required. Pass -C or --company-id.");
          }

          const rows =
            (await ctx.api.get<NotificationChannel[]>(
              `/api/companies/${companyId}/notifications/channels`,
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
                type: row.type,
                name: row.name,
                enabled: row.enabled,
              }),
            );
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  addCommonClientOptions(
    channel
      .command("delete")
      .description("Delete a notification channel")
      .argument("<id>", "Channel ID")
      .action(async (id: string, opts: ChannelDeleteOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const removed = await ctx.api.delete<NotificationChannel>(
            `/api/notifications/channels/${id}`,
          );
          printOutput(removed, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  // ── Rule subcommands ────────────────────────────────────────

  const rule = notification.command("rule").description("Manage notification rules");

  addCommonClientOptions(
    rule
      .command("create")
      .description("Create a notification rule")
      .requiredOption("-C, --company-id <id>", "Company ID")
      .requiredOption("--channel-id <id>", "Channel ID")
      .requiredOption("--event-pattern <pattern>", "Event pattern (e.g. *, issue.*, issue.created)")
      .option("--filter <json>", "Optional filter as JSON string")
      .action(async (opts: RuleCreateOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const companyId = opts.companyId;
          if (!companyId) {
            throw new Error("Company ID is required. Pass -C or --company-id.");
          }

          const body: Record<string, unknown> = {
            channelId: opts.channelId,
            eventPattern: opts.eventPattern,
          };

          if (opts.filter) {
            try {
              body.filter = JSON.parse(opts.filter);
            } catch {
              throw new Error("Invalid JSON for --filter");
            }
          }

          const created = await ctx.api.post<NotificationRule>(
            `/api/companies/${companyId}/notifications/rules`,
            body,
          );
          printOutput(created, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  addCommonClientOptions(
    rule
      .command("list")
      .description("List notification rules for a company")
      .requiredOption("-C, --company-id <id>", "Company ID")
      .action(async (opts: RuleListOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const companyId = opts.companyId;
          if (!companyId) {
            throw new Error("Company ID is required. Pass -C or --company-id.");
          }

          const rows =
            (await ctx.api.get<NotificationRule[]>(
              `/api/companies/${companyId}/notifications/rules`,
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
                channelId: row.channelId,
                eventPattern: row.eventPattern,
                enabled: row.enabled,
              }),
            );
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  addCommonClientOptions(
    rule
      .command("delete")
      .description("Delete a notification rule")
      .argument("<id>", "Rule ID")
      .action(async (id: string, opts: RuleDeleteOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const removed = await ctx.api.delete<NotificationRule>(
            `/api/notifications/rules/${id}`,
          );
          printOutput(removed, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );
}
