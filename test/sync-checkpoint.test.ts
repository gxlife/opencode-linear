import { describe, expect, test } from "bun:test"

import {
  computeSyncFingerprint,
  createSyncCandidateContent,
  evaluateSyncCheckpoint,
  getDefaultSessionSyncState,
} from "../src/utils/sync-checkpoint"

describe("evaluateSyncCheckpoint", () => {
  test("returns progress sync for milestone summaries", () => {
    const syncState = getDefaultSessionSyncState("session-1", "ENG-123", "2026-03-13T10:00:00.000Z")

    const result = evaluateSyncCheckpoint({
      syncState,
      summary: "Completed splitting the start flow into separate create and bind tools.",
      now: "2026-03-13T10:10:00.000Z",
    })

    expect(result.shouldSync).toBe(true)
    expect(result.reason).toBe("milestone")
    expect(result.kind).toBe("progress")
  })

  test("returns note sync for explicit decision hints", () => {
    const syncState = getDefaultSessionSyncState("session-1", "ENG-123", "2026-03-13T10:00:00.000Z")

    const result = evaluateSyncCheckpoint({
      syncState,
      summary: "Use SQLite-backed sync metadata instead of relying only on command prompt memory.",
      kindHint: "note",
      now: "2026-03-13T10:12:00.000Z",
    })

    expect(result.shouldSync).toBe(true)
    expect(result.reason).toBe("decision")
    expect(result.kind).toBe("note")
  })

  test("returns timeout sync when enough time passed and summary is meaningful", () => {
    const syncState = {
      ...getDefaultSessionSyncState("session-1", "ENG-123", "2026-03-13T10:00:00.000Z"),
      lastSyncedAt: "2026-03-13T10:00:00.000Z",
    }

    const result = evaluateSyncCheckpoint({
      syncState,
      summary: "Finished validating the end-to-end sync flow and documented the remaining follow-up items.",
      now: "2026-03-13T10:40:00.000Z",
    })

    expect(result.shouldSync).toBe(true)
    expect(result.reason).toBe("timeout")
    expect(result.kind).toBe("progress")
  })

  test("suppresses duplicate summaries", () => {
    const fingerprint = computeSyncFingerprint(
      "ENG-123",
      "progress",
      "Completed splitting the start flow into separate create and bind tools.",
    )
    const syncState = {
      ...getDefaultSessionSyncState("session-1", "ENG-123", "2026-03-13T10:00:00.000Z"),
      lastSyncedAt: "2026-03-13T10:20:00.000Z",
      lastSyncFingerprint: fingerprint,
      lastSyncSummary: "Completed splitting the start flow into separate create and bind tools.",
    }

    const result = evaluateSyncCheckpoint({
      syncState,
      summary: "Completed splitting the start flow into separate create and bind tools.",
      now: "2026-03-13T10:22:00.000Z",
    })

    expect(result.shouldSync).toBe(false)
    expect(result.reason).toBe("duplicate")
  })

  test("skips vague summaries", () => {
    const syncState = getDefaultSessionSyncState("session-1", "ENG-123", "2026-03-13T10:00:00.000Z")

    const result = evaluateSyncCheckpoint({
      syncState,
      summary: "Still working on it",
      now: "2026-03-13T10:22:00.000Z",
    })

    expect(result.shouldSync).toBe(false)
    expect(result.reason).toBe("no-op")
  })
})

describe("createSyncCandidateContent", () => {
  test("builds progress content", () => {
    const content = createSyncCandidateContent({
      kind: "progress",
      sessionId: "session-1",
      summary: "Completed the sync checkpoint flow and prepared the next validation pass.",
      now: "2026-03-13T10:30:00.000Z",
    })

    expect(content).toContain("### Progress Update")
    expect(content).toContain("Session: session-1")
    expect(content).toContain("Completed the sync checkpoint flow")
  })
})
