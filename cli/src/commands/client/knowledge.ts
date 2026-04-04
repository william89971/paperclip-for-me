import { Command } from "commander";
import type { KnowledgeEntry } from "@paperclipai/shared";
import {
  addCommonClientOptions,
  formatInlineRecord,
  handleCommandError,
  printOutput,
  resolveCommandContext,
  type BaseClientOptions,
} from "./common.js";

interface KnowledgeListOptions extends BaseClientOptions {
  category?: string;
}

interface KnowledgeAddOptions extends BaseClientOptions {
  title: string;
  content: string;
  category?: string;
  tags?: string;
}

interface KnowledgeSearchOptions extends BaseClientOptions {
  query: string;
}

interface KnowledgeUpdateOptions extends BaseClientOptions {
  title?: string;
  content?: string;
  category?: string;
}

export function registerKnowledgeCommands(program: Command): void {
  const knowledge = program.command("knowledge").description("Knowledge base operations");

  addCommonClientOptions(
    knowledge
      .command("add")
      .description("Create a knowledge entry")
      .requiredOption("-C, --company-id <id>", "Company ID")
      .requiredOption("--title <title>", "Entry title")
      .requiredOption("--content <content>", "Entry content")
      .option("--category <category>", "Entry category")
      .option("--tags <csv>", "Comma-separated tags")
      .action(async (opts: KnowledgeAddOptions) => {
        try {
          const ctx = resolveCommandContext(opts, { requireCompany: true });
          const tags = opts.tags
            ? opts.tags.split(",").map((t) => t.trim()).filter(Boolean)
            : undefined;

          const payload = {
            title: opts.title,
            content: opts.content,
            category: opts.category,
            tags,
          };

          const created = await ctx.api.post<KnowledgeEntry>(
            `/api/companies/${ctx.companyId}/knowledge`,
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
    knowledge
      .command("list")
      .description("List knowledge entries for a company")
      .option("-C, --company-id <id>", "Company ID")
      .option("--category <category>", "Filter by category")
      .action(async (opts: KnowledgeListOptions) => {
        try {
          const ctx = resolveCommandContext(opts, { requireCompany: true });
          const params = new URLSearchParams();
          if (opts.category) params.set("category", opts.category);

          const query = params.toString();
          const path = `/api/companies/${ctx.companyId}/knowledge${query ? `?${query}` : ""}`;
          const rows = (await ctx.api.get<KnowledgeEntry[]>(path)) ?? [];

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
                title: item.title,
                category: item.category ?? "",
                tagsCount: item.tags?.length ?? 0,
                updatedAt: item.updatedAt,
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
    knowledge
      .command("search")
      .description("Search knowledge entries")
      .option("-C, --company-id <id>", "Company ID")
      .requiredOption("--query <q>", "Search query")
      .action(async (opts: KnowledgeSearchOptions) => {
        try {
          const ctx = resolveCommandContext(opts, { requireCompany: true });
          const params = new URLSearchParams({ q: opts.query });
          const path = `/api/companies/${ctx.companyId}/knowledge/search?${params.toString()}`;
          const rows = (await ctx.api.get<KnowledgeEntry[]>(path)) ?? [];

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
                title: item.title,
                category: item.category ?? "",
                tagsCount: item.tags?.length ?? 0,
                updatedAt: item.updatedAt,
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
    knowledge
      .command("get")
      .description("Get a knowledge entry by ID")
      .argument("<id>", "Knowledge entry ID")
      .action(async (id: string, opts: BaseClientOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const entry = await ctx.api.get<KnowledgeEntry>(`/api/knowledge/${id}`);
          printOutput(entry, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  addCommonClientOptions(
    knowledge
      .command("update")
      .description("Update a knowledge entry")
      .argument("<id>", "Knowledge entry ID")
      .option("--title <title>", "Entry title")
      .option("--content <content>", "Entry content")
      .option("--category <category>", "Entry category")
      .action(async (id: string, opts: KnowledgeUpdateOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const payload: Record<string, unknown> = {};
          if (opts.title !== undefined) payload.title = opts.title;
          if (opts.content !== undefined) payload.content = opts.content;
          if (opts.category !== undefined) payload.category = opts.category;

          const updated = await ctx.api.patch<KnowledgeEntry>(`/api/knowledge/${id}`, payload);
          printOutput(updated, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  addCommonClientOptions(
    knowledge
      .command("delete")
      .description("Delete a knowledge entry")
      .argument("<id>", "Knowledge entry ID")
      .action(async (id: string, opts: BaseClientOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const deleted = await ctx.api.delete<KnowledgeEntry>(`/api/knowledge/${id}`);
          printOutput(deleted, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );
}
