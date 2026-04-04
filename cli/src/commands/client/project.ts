import { Command } from "commander";
import {
  createProjectSchema,
  createProjectWorkspaceSchema,
  updateProjectSchema,
  type Project,
  type ProjectWorkspace,
} from "@paperclipai/shared";
import {
  addCommonClientOptions,
  formatInlineRecord,
  handleCommandError,
  printOutput,
  resolveCommandContext,
  type BaseClientOptions,
} from "./common.js";

interface ProjectListOptions extends BaseClientOptions {}

interface ProjectCreateOptions extends BaseClientOptions {
  name: string;
  description?: string;
  status?: string;
  goalId?: string;
  leadAgentId?: string;
  targetDate?: string;
  color?: string;
  repoUrl?: string;
  repoRef?: string;
  cwd?: string;
}

interface ProjectUpdateOptions extends BaseClientOptions {
  name?: string;
  description?: string;
  status?: string;
  goalId?: string;
  leadAgentId?: string;
  targetDate?: string;
  color?: string;
}

interface WorkspaceCreateOptions extends BaseClientOptions {
  name?: string;
  repoUrl?: string;
  repoRef?: string;
  cwd?: string;
  primary?: boolean;
}

interface WorkspaceUpdateOptions extends BaseClientOptions {
  name?: string;
  repoUrl?: string;
  repoRef?: string;
  cwd?: string;
  primary?: boolean;
}

export function registerProjectCommands(program: Command): void {
  const project = program.command("project").description("Project operations");

  addCommonClientOptions(
    project
      .command("list")
      .description("List projects for a company")
      .requiredOption("-C, --company-id <id>", "Company ID")
      .action(async (opts: ProjectListOptions) => {
        try {
          const ctx = resolveCommandContext(opts, { requireCompany: true });
          const rows = (await ctx.api.get<Project[]>(`/api/companies/${ctx.companyId}/projects`)) ?? [];

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
                name: row.name,
                status: row.status,
                urlKey: row.urlKey,
                leadAgentId: row.leadAgentId,
                workspaces: row.workspaces.length,
                repoUrl: row.primaryWorkspace?.repoUrl,
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
    project
      .command("get")
      .description("Get a project by ID or URL key")
      .argument("<projectId>", "Project ID or URL key")
      .option("-C, --company-id <id>", "Company ID (needed for URL key resolution)")
      .action(async (projectId: string, opts: BaseClientOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const query = ctx.companyId ? `?companyId=${ctx.companyId}` : "";
          const row = await ctx.api.get<Project>(`/api/projects/${encodeURIComponent(projectId)}${query}`);
          printOutput(row, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  addCommonClientOptions(
    project
      .command("create")
      .description("Create a project (optionally with a GitHub repo workspace)")
      .requiredOption("-C, --company-id <id>", "Company ID")
      .requiredOption("--name <name>", "Project name")
      .option("--description <text>", "Project description")
      .option("--status <status>", "Project status")
      .option("--goal-id <id>", "Goal ID to link")
      .option("--lead-agent-id <id>", "Lead agent ID")
      .option("--target-date <date>", "Target date (ISO 8601)")
      .option("--color <color>", "Project color")
      .option("--repo-url <url>", "GitHub repository URL for context (e.g. https://github.com/user/repo)")
      .option("--repo-ref <ref>", "Branch or tag (default: main)")
      .option("--cwd <path>", "Local working directory for the workspace")
      .action(async (opts: ProjectCreateOptions) => {
        try {
          const ctx = resolveCommandContext(opts, { requireCompany: true });

          const hasWorkspace = opts.repoUrl || opts.cwd;
          const workspace = hasWorkspace
            ? {
                repoUrl: opts.repoUrl || null,
                repoRef: opts.repoRef || null,
                cwd: opts.cwd || null,
                isPrimary: true,
              }
            : undefined;

          const payload = createProjectSchema.parse({
            name: opts.name,
            description: opts.description,
            status: opts.status,
            goalIds: opts.goalId ? [opts.goalId] : undefined,
            leadAgentId: opts.leadAgentId,
            targetDate: opts.targetDate,
            color: opts.color,
            workspace,
          });

          const created = await ctx.api.post<Project>(
            `/api/companies/${ctx.companyId}/projects`,
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
    project
      .command("update")
      .description("Update a project")
      .argument("<projectId>", "Project ID")
      .option("--name <name>", "Project name")
      .option("--description <text>", "Project description")
      .option("--status <status>", "Project status")
      .option("--goal-id <id>", "Goal ID")
      .option("--lead-agent-id <id>", "Lead agent ID")
      .option("--target-date <date>", "Target date")
      .option("--color <color>", "Project color")
      .action(async (projectId: string, opts: ProjectUpdateOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const payload = updateProjectSchema.parse({
            name: opts.name,
            description: opts.description,
            status: opts.status,
            goalIds: opts.goalId ? [opts.goalId] : undefined,
            leadAgentId: opts.leadAgentId,
            targetDate: opts.targetDate,
            color: opts.color,
          });

          const updated = await ctx.api.patch<Project>(`/api/projects/${projectId}`, payload);
          printOutput(updated, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  addCommonClientOptions(
    project
      .command("delete")
      .description("Delete a project")
      .argument("<projectId>", "Project ID")
      .action(async (projectId: string, opts: BaseClientOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const deleted = await ctx.api.delete<Project>(`/api/projects/${projectId}`);
          printOutput(deleted, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  // --- Workspace sub-commands ---

  const workspace = project.command("workspace").description("Project workspace operations");

  addCommonClientOptions(
    workspace
      .command("list")
      .description("List workspaces for a project")
      .argument("<projectId>", "Project ID")
      .action(async (projectId: string, opts: BaseClientOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const rows =
            (await ctx.api.get<ProjectWorkspace[]>(`/api/projects/${projectId}/workspaces`)) ?? [];

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
                name: row.name,
                isPrimary: row.isPrimary,
                repoUrl: row.repoUrl,
                repoRef: row.repoRef,
                cwd: row.cwd,
              }),
            );
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  addCommonClientOptions(
    workspace
      .command("create")
      .description("Add a workspace (e.g. GitHub repo) to a project")
      .argument("<projectId>", "Project ID")
      .option("--name <name>", "Workspace name (auto-derived from repo URL or cwd if omitted)")
      .option("--repo-url <url>", "GitHub repository URL (e.g. https://github.com/user/repo)")
      .option("--repo-ref <ref>", "Branch or tag (e.g. main, develop, v1.0)")
      .option("--cwd <path>", "Local working directory")
      .option("--primary", "Set as primary workspace", false)
      .action(async (projectId: string, opts: WorkspaceCreateOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const payload = createProjectWorkspaceSchema.parse({
            name: opts.name,
            repoUrl: opts.repoUrl || null,
            repoRef: opts.repoRef || null,
            cwd: opts.cwd || null,
            isPrimary: opts.primary ?? false,
          });

          const created = await ctx.api.post<ProjectWorkspace>(
            `/api/projects/${projectId}/workspaces`,
            payload,
          );
          printOutput(created, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  addCommonClientOptions(
    workspace
      .command("update")
      .description("Update a workspace")
      .argument("<projectId>", "Project ID")
      .argument("<workspaceId>", "Workspace ID")
      .option("--name <name>", "Workspace name")
      .option("--repo-url <url>", "GitHub repository URL")
      .option("--repo-ref <ref>", "Branch or tag")
      .option("--cwd <path>", "Local working directory")
      .option("--primary", "Set as primary workspace")
      .action(async (projectId: string, workspaceId: string, opts: WorkspaceUpdateOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const payload: Record<string, unknown> = {};
          if (opts.name !== undefined) payload.name = opts.name;
          if (opts.repoUrl !== undefined) payload.repoUrl = opts.repoUrl;
          if (opts.repoRef !== undefined) payload.repoRef = opts.repoRef;
          if (opts.cwd !== undefined) payload.cwd = opts.cwd;
          if (opts.primary !== undefined) payload.isPrimary = opts.primary;

          const updated = await ctx.api.patch<ProjectWorkspace>(
            `/api/projects/${projectId}/workspaces/${workspaceId}`,
            payload,
          );
          printOutput(updated, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  addCommonClientOptions(
    workspace
      .command("delete")
      .description("Remove a workspace from a project")
      .argument("<projectId>", "Project ID")
      .argument("<workspaceId>", "Workspace ID")
      .action(async (projectId: string, workspaceId: string, opts: BaseClientOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const deleted = await ctx.api.delete<ProjectWorkspace>(
            `/api/projects/${projectId}/workspaces/${workspaceId}`,
          );
          printOutput(deleted, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );
}
