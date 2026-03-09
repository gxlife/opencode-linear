import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { z } from "zod"
import { getProjectId } from "../kdco-primitives/get-project-id"

export interface SessionIssue {
  sessionId: string
  issueId: string
  issueTitle: string
  issueState: string
  updatedAt: string
}

const sessionIssueSchema = z.object({
  sessionId: z.string().min(1),
  issueId: z.string().min(1),
  issueTitle: z.string().min(1),
  issueState: z.string().min(1),
  updatedAt: z.string().min(1),
})

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
