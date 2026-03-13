import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { z } from "zod"
import { getProjectId } from "./utils/project-id"

export interface SessionIssue {
  sessionId: string
  issueId: string
  issueTitle: string
  issueState: string
  updatedAt: string
}

export interface SessionSyncState {
  sessionId: string
  issueId: string
  lastSyncedAt: string | null
  lastSyncKind: "progress" | "note" | null
  lastSyncSummary: string | null
  lastSyncFingerprint: string | null
  lastCheckpointAt: string | null
  lastUserVisibleSummaryAt: string | null
  pendingMilestone: string | null
  pendingDecision: string | null
  pendingSummary: string | null
  syncRequiredBeforeReview: number
  syncRequiredBeforeClose: number
  createdAt: string
  updatedAt: string
}

interface EnsureSessionSyncStateInput {
  sessionId: string
  issueId: string
  now: string
}

interface RecordSessionSyncInput {
  sessionId: string
  issueId: string
  kind: "progress" | "note"
  summary: string
  fingerprint: string
  now: string
}

const sessionIssueSchema = z.object({
  sessionId: z.string().min(1),
  issueId: z.string().min(1),
  issueTitle: z.string().min(1),
  issueState: z.string().min(1),
  updatedAt: z.string().min(1),
})

const sessionSyncStateSchema = z.object({
  sessionId: z.string().min(1),
  issueId: z.string().min(1),
  lastSyncedAt: z.string().nullable(),
  lastSyncKind: z.enum(["progress", "note"]).nullable(),
  lastSyncSummary: z.string().nullable(),
  lastSyncFingerprint: z.string().nullable(),
  lastCheckpointAt: z.string().nullable(),
  lastUserVisibleSummaryAt: z.string().nullable(),
  pendingMilestone: z.string().nullable(),
  pendingDecision: z.string().nullable(),
  pendingSummary: z.string().nullable(),
  syncRequiredBeforeReview: z.number().int().nonnegative(),
  syncRequiredBeforeClose: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
})

function buildDefaultSessionSyncState(input: EnsureSessionSyncStateInput): SessionSyncState {
  return {
    sessionId: input.sessionId,
    issueId: input.issueId,
    lastSyncedAt: null,
    lastSyncKind: null,
    lastSyncSummary: null,
    lastSyncFingerprint: null,
    lastCheckpointAt: null,
    lastUserVisibleSummaryAt: null,
    pendingMilestone: null,
    pendingDecision: null,
    pendingSummary: null,
    syncRequiredBeforeReview: 0,
    syncRequiredBeforeClose: 0,
    createdAt: input.now,
    updatedAt: input.now,
  }
}

function getDbDir(): string {
  return path.join(os.homedir(), ".local", "share", "opencode", "plugins", "linear-workflow")
}

async function getDbPath(projectRoot: string): Promise<string> {
  const projectId = await getProjectId(projectRoot)
  return path.join(getDbDir(), `${projectId}.sqlite`)
}

export async function initLinearWorkflowDb(projectRoot: string): Promise<Database> {
  const dbPath = await getDbPath(projectRoot)
  mkdirSync(path.dirname(dbPath), { recursive: true })

  const db = new Database(dbPath)
  db.exec("PRAGMA journal_mode=WAL")
  db.exec("PRAGMA busy_timeout=5000")

  db.exec(`
    CREATE TABLE IF NOT EXISTS session_issue (
      session_id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL,
      issue_title TEXT NOT NULL,
      issue_state TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS session_sync_state (
      session_id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL,
      last_synced_at TEXT,
      last_sync_kind TEXT,
      last_sync_summary TEXT,
      last_sync_fingerprint TEXT,
      last_checkpoint_at TEXT,
      last_user_visible_summary_at TEXT,
      pending_milestone TEXT,
      pending_decision TEXT,
      pending_summary TEXT,
      sync_required_before_review INTEGER NOT NULL DEFAULT 0,
      sync_required_before_close INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  return db
}

export function upsertSessionIssue(db: Database, input: SessionIssue): void {
  const parsed = sessionIssueSchema.parse(input)

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO session_issue (session_id, issue_id, issue_title, issue_state, updated_at)
    VALUES ($sessionId, $issueId, $issueTitle, $issueState, $updatedAt)
  `)

  stmt.run({
    $sessionId: parsed.sessionId,
    $issueId: parsed.issueId,
    $issueTitle: parsed.issueTitle,
    $issueState: parsed.issueState,
    $updatedAt: parsed.updatedAt,
  })
}

export function getSessionIssue(db: Database, sessionId: string): SessionIssue | null {
  if (!sessionId) return null

  const stmt = db.prepare(`
    SELECT
      session_id as sessionId,
      issue_id as issueId,
      issue_title as issueTitle,
      issue_state as issueState,
      updated_at as updatedAt
    FROM session_issue
    WHERE session_id = $sessionId
  `)

  const row = stmt.get({ $sessionId: sessionId }) as SessionIssue | null
  return row ?? null
}

export function getSessionSyncState(db: Database, sessionId: string): SessionSyncState | null {
  if (!sessionId) return null

  const stmt = db.prepare(`
    SELECT
      session_id as sessionId,
      issue_id as issueId,
      last_synced_at as lastSyncedAt,
      last_sync_kind as lastSyncKind,
      last_sync_summary as lastSyncSummary,
      last_sync_fingerprint as lastSyncFingerprint,
      last_checkpoint_at as lastCheckpointAt,
      last_user_visible_summary_at as lastUserVisibleSummaryAt,
      pending_milestone as pendingMilestone,
      pending_decision as pendingDecision,
      pending_summary as pendingSummary,
      sync_required_before_review as syncRequiredBeforeReview,
      sync_required_before_close as syncRequiredBeforeClose,
      created_at as createdAt,
      updated_at as updatedAt
    FROM session_sync_state
    WHERE session_id = $sessionId
  `)

  const row = stmt.get({ $sessionId: sessionId }) as SessionSyncState | null
  if (!row) return null
  return sessionSyncStateSchema.parse(row)
}

export function upsertSessionSyncState(db: Database, input: SessionSyncState): void {
  const parsed = sessionSyncStateSchema.parse(input)

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO session_sync_state (
      session_id,
      issue_id,
      last_synced_at,
      last_sync_kind,
      last_sync_summary,
      last_sync_fingerprint,
      last_checkpoint_at,
      last_user_visible_summary_at,
      pending_milestone,
      pending_decision,
      pending_summary,
      sync_required_before_review,
      sync_required_before_close,
      created_at,
      updated_at
    ) VALUES (
      $sessionId,
      $issueId,
      $lastSyncedAt,
      $lastSyncKind,
      $lastSyncSummary,
      $lastSyncFingerprint,
      $lastCheckpointAt,
      $lastUserVisibleSummaryAt,
      $pendingMilestone,
      $pendingDecision,
      $pendingSummary,
      $syncRequiredBeforeReview,
      $syncRequiredBeforeClose,
      $createdAt,
      $updatedAt
    )
  `)

  stmt.run({
    $sessionId: parsed.sessionId,
    $issueId: parsed.issueId,
    $lastSyncedAt: parsed.lastSyncedAt,
    $lastSyncKind: parsed.lastSyncKind,
    $lastSyncSummary: parsed.lastSyncSummary,
    $lastSyncFingerprint: parsed.lastSyncFingerprint,
    $lastCheckpointAt: parsed.lastCheckpointAt,
    $lastUserVisibleSummaryAt: parsed.lastUserVisibleSummaryAt,
    $pendingMilestone: parsed.pendingMilestone,
    $pendingDecision: parsed.pendingDecision,
    $pendingSummary: parsed.pendingSummary,
    $syncRequiredBeforeReview: parsed.syncRequiredBeforeReview,
    $syncRequiredBeforeClose: parsed.syncRequiredBeforeClose,
    $createdAt: parsed.createdAt,
    $updatedAt: parsed.updatedAt,
  })
}

export function ensureSessionSyncState(db: Database, input: EnsureSessionSyncStateInput): SessionSyncState {
  const existing = getSessionSyncState(db, input.sessionId)
  if (!existing) {
    const created = buildDefaultSessionSyncState(input)
    upsertSessionSyncState(db, created)
    return created
  }

  if (existing.issueId !== input.issueId) {
    const reset = buildDefaultSessionSyncState(input)
    upsertSessionSyncState(db, reset)
    return reset
  }

  return existing
}

export function resetSessionSyncState(db: Database, input: EnsureSessionSyncStateInput): SessionSyncState {
  const reset = buildDefaultSessionSyncState(input)
  upsertSessionSyncState(db, reset)
  return reset
}

export function recordSessionSync(db: Database, input: RecordSessionSyncInput): SessionSyncState {
  const current = ensureSessionSyncState(db, {
    sessionId: input.sessionId,
    issueId: input.issueId,
    now: input.now,
  })

  const next: SessionSyncState = {
    ...current,
    issueId: input.issueId,
    lastSyncedAt: input.now,
    lastSyncKind: input.kind,
    lastSyncSummary: input.summary,
    lastSyncFingerprint: input.fingerprint,
    pendingMilestone: null,
    pendingDecision: null,
    pendingSummary: null,
    syncRequiredBeforeReview: 0,
    syncRequiredBeforeClose: 0,
    updatedAt: input.now,
  }

  upsertSessionSyncState(db, next)
  return next
}
