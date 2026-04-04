import { Command } from "commander";
import type { AgentMessage } from "@paperclipai/shared";
import {
  addCommonClientOptions,
  formatInlineRecord,
  handleCommandError,
  printOutput,
  resolveCommandContext,
  type BaseClientOptions,
} from "./common.js";

interface MessageSendOptions extends BaseClientOptions {
  from: string;
  to: string;
  body: string;
  subject?: string;
}

export function registerMessageCommands(program: Command): void {
  const message = program.command("message").description("Inter-agent messaging operations");

  addCommonClientOptions(
    message
      .command("list")
      .description("List messages for a company")
      .requiredOption("-C, --company-id <id>", "Company ID")
      .action(async (opts: BaseClientOptions) => {
        try {
          const ctx = resolveCommandContext(opts, { requireCompany: true });
          const rows = (await ctx.api.get<AgentMessage[]>(
            `/api/companies/${ctx.companyId}/messages`,
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
                from: item.fromAgentId,
                to: item.toAgentId,
                subject: item.subject,
                readAt: item.readAt,
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

  addCommonClientOptions(
    message
      .command("inbox")
      .description("List inbox messages for an agent")
      .requiredOption("--agent-id <id>", "Agent ID")
      .option("--unread-only", "Only show unread messages")
      .action(async (opts: BaseClientOptions & { agentId: string; unreadOnly?: boolean }) => {
        try {
          const ctx = resolveCommandContext(opts);
          const params = new URLSearchParams();
          if (opts.unreadOnly) params.set("unreadOnly", "true");
          const query = params.toString();
          const path = `/api/agents/${opts.agentId}/inbox${query ? `?${query}` : ""}`;
          const rows = (await ctx.api.get<AgentMessage[]>(path)) ?? [];

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
                from: item.fromAgentId,
                subject: item.subject,
                readAt: item.readAt,
                createdAt: item.createdAt,
              }),
            );
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  addCommonClientOptions(
    message
      .command("send")
      .description("Send a message from one agent to another")
      .requiredOption("-C, --company-id <id>", "Company ID")
      .requiredOption("--from <id>", "Sender agent ID")
      .requiredOption("--to <id>", "Recipient agent ID")
      .requiredOption("--body <text>", "Message body")
      .option("--subject <text>", "Message subject")
      .action(async (opts: MessageSendOptions) => {
        try {
          const ctx = resolveCommandContext(opts, { requireCompany: true });
          const payload = {
            fromAgentId: opts.from,
            toAgentId: opts.to,
            body: opts.body,
            subject: opts.subject,
          };
          const created = await ctx.api.post<AgentMessage>(
            `/api/companies/${ctx.companyId}/messages`,
            payload,
          );
          printOutput(created, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeCompany: false },
  );

  addCommonClientOptions(
    message
      .command("read")
      .description("Mark a message as read")
      .argument("<messageId>", "Message ID")
      .action(async (messageId: string, opts: BaseClientOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const updated = await ctx.api.patch<AgentMessage>(
            `/api/messages/${messageId}/read`,
          );
          printOutput(updated, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  addCommonClientOptions(
    message
      .command("get")
      .description("Get a message by ID")
      .argument("<messageId>", "Message ID")
      .action(async (messageId: string, opts: BaseClientOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const msg = await ctx.api.get<AgentMessage>(
            `/api/messages/${messageId}`,
          );
          printOutput(msg, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );
}
