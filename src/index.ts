import type { Database } from "bun:sqlite"
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { type Plugin, tool } from "@opencode-ai/plugin"

import {
  ensureSessionSyncState,
  getSessionIssue,
  getSessionSyncState,
  initLinearWorkflowDb,
  recordSessionSync,
  upsertSessionIssue,
  upsertSessionSyncState,
} from "./state"
import { computeSyncFingerprint, createSyncCandidateContent, evaluateSyncCheckpoint } from "./utils/sync-checkpoint"

interface Logger {
  debug: (msg: string) => void
  info: (msg: string) => void
  warn: (msg: string) => void
  error: (msg: string) => void
}

interface IssueDetails {
  issueId: string
  title: string
  description: string
  stateName: string
}

interface LinearWorkflowConfig {
  project?: string
  team?: string
  labels?: string[]
  defaultState?: string
}

let db: Database | null = null
let cachedConfig: LinearWorkflowConfig | null = null
let cachedConfigPath: string | null = null
let cachedConfigMtime: number = 0

function normalizeText(input: unknown): string {
  return typeof input === "string" ? input : ""
}

function isIssueIdentifier(input: string): boolean {
  return /^[A-Z][A-Z0-9]+-\d+$/.test(input.trim())
}

/**
 * Parse input to extract issue ID and task description
 * Supports formats:
 *   - "ENG-123" (just issue ID)
 *   - "ENG-123 implement login feature" (issue ID + task)
 *   - "implement login feature" (just task description)
 */
function parseIssueInput(input: string): { issueId: string | null; taskDescription: string } {
  const trimmed = input.trim()
  
  // Match issue ID at the start followed by optional task description
  // Pattern: ISSUE-ID at start, optionally followed by space and description
  const match = trimmed.match(/^([A-Z][A-Z0-9]+-\d+)(?:\s+(.*))?$/s)
  
  if (match) {
    return {
      issueId: match[1],
      taskDescription: match[2]?.trim() || ""
    }
  }
  
  // No issue ID found, treat entire input as task description
  return { issueId: null, taskDescription: trimmed }
}

function extractTitleFromInput(input: string): string {
  const firstLine = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0)
  if (!firstLine) return "Untitled task"
  return firstLine.slice(0, 120)
}

function issueIdFromText(output: string): string | null {
  const match = output.match(/\b([A-Z][A-Z0-9]+-\d+)\b/)
  return match?.[1] ?? null
}

function compactText(text: string, max = 1200): string {
  const withoutPlaceholders = text.trim().replace(/\[Pasted ~\d+ lines?\]/g, "")
  const normalized = withoutPlaceholders.replace(/\n{3,}/g, "\n\n")
  return normalized.length > max ? `${normalized.slice(0, max)}\n\n...` : normalized
}

function looksLikeFormattedSyncComment(content: string): boolean {
  const trimmed = content.trimStart()
  return trimmed.startsWith("### Progress Update") || trimmed.startsWith("### Note")
}

function inferSyncKind(content: string, explicitKind?: "progress" | "note"): "progress" | "note" {
  if (explicitKind) {
    return explicitKind
  }
  return content.trimStart().startsWith("### Note") ? "note" : "progress"
}

async function runLinear(args: string[], cwd: string): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  try {
    const proc = Bun.spawn(["linear", ...args], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    })

    const [stdout, stderr, exited] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])

    return {
      ok: exited === 0,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    }
  } catch (error) {
    return {
      ok: false,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
    }
  }
}

function extractIssueFromJson(raw: string, fallbackIssueId: string): IssueDetails | null {
  try {
    const parsed = JSON.parse(raw)
    const issue = parsed?.data?.issue ?? parsed?.issue ?? parsed

    const title =
      normalizeText(issue?.title) ||
      normalizeText(issue?.name) ||
      fallbackIssueId

    const description =
      normalizeText(issue?.description) ||
      normalizeText(issue?.body) ||
      normalizeText(issue?.data?.description) ||
      ""

    const stateName =
      normalizeText(issue?.state?.name) ||
      normalizeText(issue?.state) ||
      ""

    return {
      issueId: fallbackIssueId,
      title,
      description,
      stateName,
    }
  } catch {
    return null
  }
}

async function updateIssueStateWithFallbacks(
  issueId: string,
  candidates: string[],
  cwd: string,
): Promise<{ ok: boolean; stateUsed?: string; error?: string }> {
  let lastError = ""

  for (const state of candidates) {
    const updated = await runLinear(["issue", "update", issueId, "--state", state], cwd)
    if (updated.ok) {
      return { ok: true, stateUsed: state }
    }
    lastError = updated.stderr || updated.stdout || lastError
  }

  return { ok: false, error: lastError || "Failed to update issue state" }
}

async function addCommentViaTempFile(issueId: string, content: string, cwd: string): Promise<{ ok: boolean; error?: string }> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "linear-workflow-"))
  const filePath = path.join(tempDir, "comment.md")

  try {
    await writeFile(filePath, content, "utf8")
    const result = await runLinear(["issue", "comment", "add", issueId, "--body-file", filePath], cwd)
    if (!result.ok) {
      return { ok: false, error: result.stderr || result.stdout }
    }
    return { ok: true }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

async function ensureDb(directory: string): Promise<Database> {
  if (!db) {
    db = await initLinearWorkflowDb(directory)
  }
  return db
}

function buildCheckpointSummary(summary: string): string {
  return compactText(summary, 1000)
}

function buildStartResponse(issue: IssueDetails, startedState: string | null, taskPrompt: string): string {
  const stateLine = startedState ? `State updated to: ${startedState}` : "State unchanged"
  return [
    `Linked issue: ${issue.issueId}`,
    `Title: ${issue.title}`,
    stateLine,
    "",
    "TASK_PROMPT:",
    taskPrompt.trim(),
  ].join("\n")
}

function shouldAutoPromote(stateName: string): boolean {
  const normalized = stateName.trim().toLowerCase()
  return ["backlog", "todo", "to do", "unstarted", "triage"].includes(normalized)
}

const stateCandidates: Record<string, string[]> = {
  in_progress: ["started", "in progress", "inprogress"],
  in_review: ["in review", "review", "ready review", "ready for review"],
  completed: ["completed", "done"],
  canceled: ["canceled", "cancelled"],
}

function getConfigPaths(directory: string): string[] {
  return [
    path.join(directory, ".opencode", "linear-workflow.json"),
    path.join(directory, ".opencode", "linear-workflow.jsonc"),
    path.join(os.homedir(), ".config", "opencode", "linear-workflow.json"),
    path.join(os.homedir(), ".config", "opencode", "linear-workflow.jsonc"),
  ]
}

async function hasConfigChanged(directory: string): Promise<{ changed: boolean; path: string | null; mtime: number }> {
  const configPaths = getConfigPaths(directory)

  for (const configPath of configPaths) {
    try {
      const fileStat = await stat(configPath)
      if (fileStat.isFile()) {
        const mtime = fileStat.mtimeMs
        if (cachedConfigPath === configPath && cachedConfigMtime === mtime) {
          return { changed: false, path: configPath, mtime }
        }
        return { changed: true, path: configPath, mtime }
      }
    } catch {
      continue
    }
  }

  return { changed: cachedConfigPath !== null, path: null, mtime: 0 }
}

async function loadConfig(directory: string, log?: Logger): Promise<LinearWorkflowConfig> {
  const { changed, path: configPath, mtime } = await hasConfigChanged(directory)

  if (!changed && cachedConfig) {
    log?.debug(`Using cached Linear workflow config from ${cachedConfigPath}`)
    return cachedConfig
  }

  if (cachedConfig && changed && configPath) {
    log?.info(`Config file changed, reloading from ${configPath}`)
  }

  const configPaths = getConfigPaths(directory)

  for (const currentPath of configPaths) {
    try {
      const file = Bun.file(currentPath)
      if (!(await file.exists())) continue

      const fileStat = await stat(currentPath)
      const currentMtime = fileStat.mtimeMs

      log?.debug(`Loading Linear workflow config from: ${currentPath}`)
      const content = await file.text()
      const cleaned = content
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "")
        .replace(/,\s*([}\]])/g, "$1")

      cachedConfig = JSON.parse(cleaned) as LinearWorkflowConfig
      cachedConfigPath = currentPath
      cachedConfigMtime = currentMtime

      log?.info(`Loaded Linear workflow config: project=${cachedConfig.project || "(none)"}, team=${cachedConfig.team || "(none)"}, labels=${cachedConfig.labels?.join(",") || "(none)"}`)
      return cachedConfig
    } catch (err) {
      log?.warn(`Failed to parse config at ${currentPath}: ${err instanceof Error ? err.message : String(err)}`)
      continue
    }
  }

  log?.debug("No Linear workflow config found, using defaults")
  cachedConfig = {}
  cachedConfigPath = null
  cachedConfigMtime = 0
  return cachedConfig
}

function buildCreateArgs(title: string, descriptionFile: string, config: LinearWorkflowConfig): string[] {
  const args = [
    "issue", "create",
    "--title", title,
    "--description-file", descriptionFile,
    "--state", config.defaultState || "backlog",
    "--no-interactive",
  ]

  if (config.project) {
    args.push("--project", config.project)
  }

  if (config.team) {
    args.push("--team", config.team)
  }

  if (config.labels && config.labels.length > 0) {
    for (const label of config.labels) {
      args.push("--label", label)
    }
  }

  return args
}

function buildListArgs(config: LinearWorkflowConfig): string[] {
  const args = ["issue", "list", "--all-states"]

  if (config.project) {
    args.push("--project", config.project)
  }

  if (config.team) {
    args.push("--team", config.team)
  }

  return args
}

export const LinearWorkflowPlugin: Plugin = async ({ client, directory }) => {
  const log: Logger = {
    debug: (msg) => client.app.log({ body: { service: "linear-workflow", level: "debug", message: msg } }).catch(() => {}),
    info: (msg) => client.app.log({ body: { service: "linear-workflow", level: "info", message: msg } }).catch(() => {}),
    warn: (msg) => client.app.log({ body: { service: "linear-workflow", level: "warn", message: msg } }).catch(() => {}),
    error: (msg) => client.app.log({ body: { service: "linear-workflow", level: "error", message: msg } }).catch(() => {}),
  }

  const database = await ensureDb(directory)
  const config = await loadConfig(directory, log)

  return {
    tool: {
      linear_workflow_create_issue: tool({
        description:
          "Create a new Linear issue from task description. Returns the created issue ID and details. Respects project/team/labels config.",
        args: {
          title: tool.schema.string().describe("Issue title (required)"),
          description: tool.schema.string().optional().describe("Issue description (optional, defaults to title)"),
        },
        async execute(args) {
          const title = args.title.trim()
          if (!title) {
            return "Title is required to create an issue."
          }

          const description = args.description?.trim() || title
          const tempDir = await mkdtemp(path.join(os.tmpdir(), "linear-workflow-"))
          const descriptionFile = path.join(tempDir, "description.md")

          try {
            await writeFile(descriptionFile, description, "utf8")
            const createArgs = buildCreateArgs(title, descriptionFile, config)
            const created = await runLinear(createArgs, directory)

            if (!created.ok) {
              return `Failed to create issue: ${created.stderr || created.stdout}`
            }

            const createdIssueId = issueIdFromText(created.stdout)
            if (!createdIssueId) {
              return `Issue may have been created, but identifier could not be parsed. Output: ${created.stdout}`
            }

            const viewed = await runLinear(["issue", "view", createdIssueId, "--json", "--no-comments"], directory)
            if (!viewed.ok) {
              return `Issue created (${createdIssueId}), but failed to view details: ${viewed.stderr || viewed.stdout}`
            }

            const issue = extractIssueFromJson(viewed.stdout, createdIssueId)
            if (!issue) {
              return `Issue created (${createdIssueId}), but failed to parse details.`
            }

            return JSON.stringify({
              success: true,
              issueId: issue.issueId,
              title: issue.title,
              stateName: issue.stateName,
              description: issue.description,
            }, null, 2)
          } finally {
            await rm(tempDir, { recursive: true, force: true })
          }
        },
      }),

      linear_workflow_bind_issue: tool({
        description:
          "Bind an existing Linear issue to current session, update state to in_progress, and return task context. Use this to start working on an issue.",
        args: {
          issueId: tool.schema.string().describe("Linear issue identifier (e.g., ENG-123)"),
          taskDescription: tool.schema.string().optional().describe("Optional additional task description to supplement the issue"),
        },
        async execute(args, toolCtx) {
          const issueId = args.issueId.trim()
          if (!issueId) {
            return "Issue ID is required."
          }

          if (!isIssueIdentifier(issueId)) {
            return `Invalid issue ID format: ${issueId}. Expected format: ENG-123`
          }

          const viewed = await runLinear(["issue", "view", issueId, "--json", "--no-comments"], directory)
          if (!viewed.ok) {
            return `Failed to find issue ${issueId}: ${viewed.stderr || viewed.stdout}`
          }

          const issue = extractIssueFromJson(viewed.stdout, issueId)
          if (!issue) {
            return `Found issue ${issueId}, but failed to parse details.`
          }

          let startedState: string | null = null
          if (shouldAutoPromote(issue.stateName)) {
            const promoted = await updateIssueStateWithFallbacks(issue.issueId, stateCandidates.in_progress, directory)
            if (promoted.ok) {
              startedState = promoted.stateUsed ?? "started"
              issue.stateName = startedState
            }
          }

          const timestamp = nowIso()

          upsertSessionIssue(database, {
            sessionId: toolCtx.sessionID,
            issueId: issue.issueId,
            issueTitle: issue.title,
            issueState: issue.stateName || "",
            updatedAt: timestamp,
          })
          ensureSessionSyncState(database, {
            sessionId: toolCtx.sessionID,
            issueId: issue.issueId,
            now: timestamp,
          })

          let taskPrompt = args.taskDescription?.trim() || ""
          if (taskPrompt) {
            taskPrompt = `${taskPrompt}\n\n(Context: ${issue.title}${issue.description ? ` - ${issue.description.slice(0, 200)}` : ""})`
          } else {
            taskPrompt = issue.description || issue.title
          }

          return buildStartResponse(issue, startedState, taskPrompt)
        },
      }),

      linear_workflow_update: tool({
        description: "Update current bound issue state to in_progress, in_review, completed, or canceled.",
        args: {
          state: tool.schema
            .enum(["in_progress", "in_review", "completed", "canceled"])
            .describe("Target workflow state"),
        },
        async execute(args, toolCtx) {
          const sessionIssue = getSessionIssue(database, toolCtx.sessionID)
          if (!sessionIssue) {
            return "No bound issue for this session. Run /issue-start first."
          }

          const candidates = stateCandidates[args.state]
          if (!candidates) {
            return `Unsupported state: ${args.state}`
          }

          const updated = await updateIssueStateWithFallbacks(sessionIssue.issueId, candidates, directory)
          if (!updated.ok) {
            return `Failed to update state: ${updated.error ?? "unknown"}`
          }

          upsertSessionIssue(database, {
            ...sessionIssue,
            issueState: updated.stateUsed ?? args.state,
            updatedAt: nowIso(),
          })

          return `Updated ${sessionIssue.issueId} to state: ${updated.stateUsed ?? args.state}`
        },
      }),

      linear_workflow_checkpoint: tool({
        description:
          "Evaluate whether the latest completed work segment should be synced to the bound Linear issue. Use this before replying after meaningful work.",
        args: {
          summary: tool.schema.string().describe("Concise summary of the work segment that just completed"),
          kindHint: tool.schema
            .enum(["progress", "note", "auto"])
            .optional()
            .describe("Optional hint for whether this is progress, a decision note, or auto-detected"),
          force: tool.schema.boolean().optional().describe("Force a stronger sync check before review or close"),
        },
        async execute(args, toolCtx) {
          const sessionIssue = getSessionIssue(database, toolCtx.sessionID)
          if (!sessionIssue) {
            return "No bound issue for this session. Run /issue-start first."
          }

          const timestamp = nowIso()
          const syncState = ensureSessionSyncState(database, {
            sessionId: toolCtx.sessionID,
            issueId: sessionIssue.issueId,
            now: timestamp,
          })
          const summary = buildCheckpointSummary(args.summary)
          const result = evaluateSyncCheckpoint({
            syncState,
            summary,
            kindHint: args.kindHint,
            force: args.force,
            now: timestamp,
          })

          const nextSyncState = {
            ...syncState,
            lastCheckpointAt: timestamp,
            pendingMilestone: result.shouldSync && result.kind === "progress" ? summary : null,
            pendingDecision: result.shouldSync && result.kind === "note" ? summary : null,
            pendingSummary: result.shouldSync ? summary : null,
            syncRequiredBeforeReview: result.shouldSync ? 1 : syncState.syncRequiredBeforeReview,
            syncRequiredBeforeClose: result.shouldSync ? 1 : syncState.syncRequiredBeforeClose,
            updatedAt: timestamp,
          }
          upsertSessionSyncState(database, nextSyncState)

          const payload = {
            shouldSync: result.shouldSync,
            reason: result.reason,
            kind: result.kind,
            content:
              result.shouldSync && result.kind
                ? createSyncCandidateContent({
                    kind: result.kind,
                    sessionId: toolCtx.sessionID,
                    summary,
                    now: timestamp,
                  })
                : null,
          }

          return JSON.stringify(payload, null, 2)
        },
      }),

      linear_sync_comment: tool({
        description: "Add a markdown comment to the current bound Linear issue. Use this when agent has meaningful progress or decisions to document.",
        args: {
          content: tool.schema.string().describe("Comment markdown content"),
          kind: tool.schema
            .enum(["progress", "note"])
            .optional()
            .describe("Comment category: progress for milestones, note for observations/decisions"),
        },
        async execute(args, toolCtx) {
          const sessionIssue = getSessionIssue(database, toolCtx.sessionID)
          if (!sessionIssue) {
            return "No bound issue for this session. Run /issue-start first."
          }

          const timestamp = nowIso()
          const normalizedContent = compactText(args.content, 6000)
          const syncKind = inferSyncKind(normalizedContent, args.kind)
          const body = looksLikeFormattedSyncComment(normalizedContent)
            ? normalizedContent
            : [
                syncKind === "progress" ? "### Progress Update" : "### Note",
                "",
                `Session: ${toolCtx.sessionID}`,
                `Time: ${timestamp}`,
                "",
                normalizedContent,
              ].join("\n")

          const added = await addCommentViaTempFile(sessionIssue.issueId, body, directory)
          if (!added.ok) {
            return `Failed to add comment: ${added.error ?? "unknown"}`
          }

          recordSessionSync(database, {
            sessionId: toolCtx.sessionID,
            issueId: sessionIssue.issueId,
            kind: syncKind,
            summary: normalizedContent,
            fingerprint: computeSyncFingerprint(sessionIssue.issueId, syncKind, normalizedContent),
            now: timestamp,
          })

          return `Comment synced to ${sessionIssue.issueId}`
        },
      }),

      linear_workflow_sync_status: tool({
        description: "Get sync checkpoint state for the current bound issue and session.",
        args: {},
        async execute(_args, toolCtx) {
          const sessionIssue = getSessionIssue(database, toolCtx.sessionID)
          if (!sessionIssue) {
            return "No bound issue for this session. Run /issue-start first."
          }

          const syncState = ensureSessionSyncState(database, {
            sessionId: toolCtx.sessionID,
            issueId: sessionIssue.issueId,
            now: nowIso(),
          })

          return JSON.stringify(syncState, null, 2)
        },
      }),

      linear_get_current_issue: tool({
        description: "Get currently bound Linear issue for this session.",
        args: {},
        async execute(_args, toolCtx) {
          const sessionIssue = getSessionIssue(database, toolCtx.sessionID)
          if (!sessionIssue) {
            return "No issue is currently bound to this session."
          }

          return JSON.stringify(sessionIssue, null, 2)
        },
      }),

      linear_workflow_list: tool({
        description: "List Linear issues respecting project/team config filters.",
        args: {
          state: tool.schema.string().optional().describe("Filter by state (backlog, unstarted, started, completed, canceled)"),
          limit: tool.schema.number().optional().describe("Maximum issues to return"),
        },
        async execute(args) {
          const listArgs = buildListArgs(config)

          if (args.state) {
            listArgs.push("--state", args.state)
          }

          if (args.limit && args.limit > 0) {
            listArgs.push("--limit", String(args.limit))
          }

          const result = await runLinear(listArgs, directory)
          if (!result.ok) {
            return `Failed to list issues: ${result.stderr || result.stdout}`
          }

          return result.stdout || "No issues found matching criteria."
        },
      }),

      linear_workflow_config: tool({
        description: "View or update Linear workflow configuration (project, team, labels).",
        args: {
          action: tool.schema.enum(["view", "set", "clear"]).describe("Config action"),
          key: tool.schema.enum(["project", "team", "labels", "defaultState"]).optional().describe("Config key to set/clear"),
          value: tool.schema.string().optional().describe("Value to set (comma-separated for labels)"),
        },
        async execute(args) {
          if (args.action === "view") {
            const cfg = await loadConfig(directory)
            const lines = [
              "Linear Workflow Configuration",
              "",
              `Project: ${cfg.project || "(not set)"}`,
              `Team: ${cfg.team || "(not set)"}`,
              `Labels: ${cfg.labels?.join(", ") || "(not set)"}`,
              `Default State: ${cfg.defaultState || "backlog"}`,
              "",
              "Config files searched (in order):",
              ...getConfigPaths(directory).map(p => `  - ${p}`),
            ]
            return lines.join("\n")
          }

          if (args.action === "clear") {
            if (!args.key) {
              return "Error: 'key' is required for clear action"
            }

            const configPath = path.join(directory, ".opencode", "linear-workflow.json")
            try {
              const file = Bun.file(configPath)
              let cfg: LinearWorkflowConfig = {}
              if (await file.exists()) {
                const content = await file.text()
                cfg = JSON.parse(content)
              }

              if (args.key === "labels") {
                delete cfg.labels
              } else {
                delete (cfg as any)[args.key]
              }

              await Bun.write(configPath, JSON.stringify(cfg, null, 2))
              cachedConfig = null
              cachedConfigPath = null
              cachedConfigMtime = 0
              return `Cleared ${args.key} from config`
            } catch (error) {
              return `Failed to clear config: ${error instanceof Error ? error.message : String(error)}`
            }
          }

          if (args.action === "set") {
            if (!args.key) {
              return "Error: 'key' is required for set action"
            }
            if (args.value === undefined) {
              return "Error: 'value' is required for set action"
            }

            const configDir = path.join(directory, ".opencode")
            const configPath = path.join(configDir, "linear-workflow.json")

            const mkdirProc = Bun.spawn(["mkdir", "-p", configDir])
            await mkdirProc.exited

            let cfg: LinearWorkflowConfig = {}
            try {
              const file = Bun.file(configPath)
              if (await file.exists()) {
                const content = await file.text()
                cfg = JSON.parse(content)
              }
            } catch {
              cfg = {}
            }

            if (args.key === "labels") {
              cfg.labels = args.value.split(",").map(s => s.trim()).filter(Boolean)
            } else {
              (cfg as any)[args.key] = args.value
            }

            await Bun.write(configPath, JSON.stringify(cfg, null, 2))
            cachedConfig = null
            cachedConfigPath = null
            cachedConfigMtime = 0
            return `Set ${args.key} = ${args.key === "labels" ? cfg.labels?.join(", ") : args.value}`
          }

          return "Unknown action"
        },
      }),
    },
  }
}

export default LinearWorkflowPlugin
