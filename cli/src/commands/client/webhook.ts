import { Command } from "commander";
import type { WebhookEndpoint, WebhookEvent } from "@paperclipai/shared";
import {
  addCommonClientOptions,
  formatInlineRecord,
  handleCommandError,
  printOutput,
  resolveCommandContext,
  type BaseClientOptions,
} from "./common.js";

interface WebhookCreateOptions extends BaseClientOptions {
  companyId: string;
  slug: string;
  targetType: string;
  targetConfig?: string;
}

interface WebhookListOptions extends BaseClientOptions {
  companyId: string;
}

interface WebhookEventsOptions extends BaseClientOptions {
  companyId: string;
  endpointId?: string;
}

export function registerWebhookCommands(program: Command): void {
  const webhook = program.command("webhook").description("Webhook operations");

  addCommonClientOptions(
    webhook
      .command("create")
      .description("Create a webhook endpoint")
      .requiredOption("-C, --company-id <id>", "Company ID")
      .requiredOption("--slug <slug>", "Webhook slug (URL path segment)")
      .requiredOption("--target-type <type>", "Target type (create_issue, wake_agent, custom)")
      .option("--target-config <json>", "Target configuration as JSON")
      .action(async (opts: WebhookCreateOptions) => {
        try {
          const ctx = resolveCommandContext(opts, { requireCompany: true });
          const payload: Record<string, unknown> = {
            slug: opts.slug,
            targetType: opts.targetType,
          };
          if (opts.targetConfig) {
            payload.targetConfig = JSON.parse(opts.targetConfig);
          }

          const created = await ctx.api.post<WebhookEndpoint>(
            `/api/companies/${ctx.companyId}/webhooks`,
            payload,
          );
          if (!created) {
            console.error("Failed to create webhook endpoint");
            process.exit(1);
          }

          if (ctx.json) {
            printOutput(created, { json: true });
          } else {
            console.log(
              formatInlineRecord({
                id: created.id,
                slug: created.slug,
                targetType: created.targetType,
                enabled: created.enabled,
              }),
            );
            console.log(`\nSecret (shown only once): ${created.secret}`);
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeCompany: false },
  );

  addCommonClientOptions(
    webhook
      .command("list")
      .description("List webhook endpoints for a company")
      .requiredOption("-C, --company-id <id>", "Company ID")
      .action(async (opts: WebhookListOptions) => {
        try {
          const ctx = resolveCommandContext(opts, { requireCompany: true });
          const rows = (await ctx.api.get<WebhookEndpoint[]>(
            `/api/companies/${ctx.companyId}/webhooks`,
          )) ?? [];

          if (ctx.json) {
            printOutput(rows, { json: true });
            return;
          }

          if (rows.length === 0) {
            printOutput([], { json: false });
            return;
          }

          for (const item of rows) {
            console.log(
              formatInlineRecord({
                id: item.id,
                slug: item.slug,
                targetType: item.targetType,
                enabled: item.enabled,
              }),
            );
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeCompany: false },
  );

  addCommonClientOptions(
    webhook
      .command("delete")
      .description("Delete a webhook endpoint")
      .argument("<webhookId>", "Webhook endpoint ID")
      .action(async (webhookId: string, opts: BaseClientOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const deleted = await ctx.api.delete<WebhookEndpoint>(
            `/api/webhooks/${webhookId}`,
          );
          printOutput(deleted, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  addCommonClientOptions(
    webhook
      .command("events")
      .description("List webhook events")
      .requiredOption("-C, --company-id <id>", "Company ID")
      .option("--endpoint-id <id>", "Filter by endpoint ID")
      .action(async (opts: WebhookEventsOptions) => {
        try {
          const ctx = resolveCommandContext(opts, { requireCompany: true });
          const endpointId = opts.endpointId ?? "";
          if (!endpointId) {
            // Events require an endpointId in the URL path
            console.error("--endpoint-id is required for listing events");
            process.exit(1);
          }

          const rows = (await ctx.api.get<WebhookEvent[]>(
            `/api/companies/${ctx.companyId}/webhooks/${endpointId}/events`,
          )) ?? [];

          if (ctx.json) {
            printOutput(rows, { json: true });
            return;
          }

          if (rows.length === 0) {
            printOutput([], { json: false });
            return;
          }

          for (const item of rows) {
            console.log(
              formatInlineRecord({
                id: item.id,
                status: item.status,
                endpointId: item.endpointId,
                resultEntityId: item.resultEntityId,
                createdAt: item.createdAt,
              }),
            );
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeCompany: false },
  );
}
