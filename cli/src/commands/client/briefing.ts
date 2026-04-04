import { Command } from "commander";
import type { CompanyBriefing } from "@paperclipai/shared";
import {
  addCommonClientOptions,
  handleCommandError,
  printOutput,
  resolveCommandContext,
  type BaseClientOptions,
} from "./common.js";

interface BriefingOptions extends BaseClientOptions {
  companyId?: string;
}

export function registerBriefingCommands(program: Command): void {
  const briefing = program.command("briefing").description("Company briefing operations");

  addCommonClientOptions(
    briefing
      .command("generate")
      .description("Generate a new briefing for a company")
      .requiredOption("-C, --company-id <id>", "Company ID")
      .action(async (opts: BriefingOptions) => {
        try {
          const ctx = resolveCommandContext(opts, { requireCompany: true });
          const row = await ctx.api.post<CompanyBriefing>(
            `/api/companies/${ctx.companyId}/briefings/generate`,
            {},
          );
          if (!row) throw new Error("No briefing returned");
          if (!ctx.json) {
            console.log(row.content);
          } else {
            printOutput(row, { json: true });
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeCompany: false },
  );

  addCommonClientOptions(
    briefing
      .command("latest")
      .description("Get the latest briefing for a company")
      .requiredOption("-C, --company-id <id>", "Company ID")
      .action(async (opts: BriefingOptions) => {
        try {
          const ctx = resolveCommandContext(opts, { requireCompany: true });
          const row = await ctx.api.get<CompanyBriefing>(
            `/api/companies/${ctx.companyId}/briefings/latest`,
          );
          if (!row) throw new Error("No briefing found for this company");
          if (!ctx.json) {
            console.log(row.content);
          } else {
            printOutput(row, { json: true });
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeCompany: false },
  );
}
