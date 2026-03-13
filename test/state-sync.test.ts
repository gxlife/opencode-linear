import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"

import {
  ensureSessionSyncState,
  getSessionSyncState,
  recordSessionSync,
  resetSessionSyncState,
} from "../src/state"

function createTestDb(): Database {
  const db = new Database(":memory:")
  db.exec("PRAGMA journal_mode=WAL")
  db.exec("PRAGMA busy_timeout=5000")
  db.exec(`
    CREATE TABLE session_issue (
      session_id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL,
      issue_title TEXT NOT NULL,
      issue_state TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  db.exec(`
    CREATE TABLE session_sync_state (
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

describe("session_sync_state", () => {
  test("creates sync state when ensuring a bound issue", () => {
    const db = createTestDb()

    ensureSessionSyncState(db, {
      sessionId: "session-1",
      issueId: "ENG-123",
      now: "2026-03-13T10:00:00.000Z",
    })

    const state = getSessionSyncState(db, "session-1")
    expect(state).not.toBeNull()
    expect(state?.issueId).toBe("ENG-123")
    expect(state?.lastSyncedAt).toBeNull()
    expect(state?.syncRequiredBeforeReview).toBe(0)
  })

  test("resets pending state when rebinding to another issue", () => {
    const db = createTestDb()

    ensureSessionSyncState(db, {
      sessionId: "session-1",
      issueId: "ENG-123",
      now: "2026-03-13T10:00:00.000Z",
    })
    recordSessionSync(db, {
      sessionId: "session-1",
      issueId: "ENG-123",
      kind: "progress",
      summary: "Completed sync checkpoint design.",
      fingerprint: "fp-1",
      now: "2026-03-13T10:10:00.000Z",
    })

    resetSessionSyncState(db, {
      sessionId: "session-1",
      issueId: "ENG-456",
      now: "2026-03-13T10:20:00.000Z",
    })

    const state = getSessionSyncState(db, "session-1")
    expect(state?.issueId).toBe("ENG-456")
    expect(state?.lastSyncedAt).toBeNull()
    expect(state?.lastSyncSummary).toBeNull()
  })

  test("records successful sync metadata", () => {
    const db = createTestDb()

    ensureSessionSyncState(db, {
      sessionId: "session-1",
      issueId: "ENG-123",
      now: "2026-03-13T10:00:00.000Z",
    })

    recordSessionSync(db, {
      sessionId: "session-1",
      issueId: "ENG-123",
      kind: "note",
      summary: "Use SQLite-backed sync state for checkpoint recovery.",
      fingerprint: "fp-2",
      now: "2026-03-13T10:15:00.000Z",
    })

    const state = getSessionSyncState(db, "session-1")
    expect(state?.lastSyncedAt).toBe("2026-03-13T10:15:00.000Z")
    expect(state?.lastSyncKind).toBe("note")
    expect(state?.lastSyncFingerprint).toBe("fp-2")
  })
})
