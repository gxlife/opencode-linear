import type { SessionSyncState } from "../state"

export type SyncKind = "progress" | "note"

export interface SyncCheckpointResult {
  shouldSync: boolean
  reason: "milestone" | "decision" | "timeout" | "forced" | "duplicate" | "no-op"
  kind: SyncKind | null
  fingerprint: string | null
}

interface EvaluateSyncCheckpointInput {
  syncState: SessionSyncState
  summary: string
  kindHint?: SyncKind | "auto"
  force?: boolean
  now: string
}

interface CreateSyncCandidateContentInput {
  kind: SyncKind
  sessionId: string
  summary: string
  now: string
}

const MIN_SUMMARY_LENGTH = 20
const TIMEOUT_MINUTES = 35
const VAGUE_PATTERNS = [
  /still working/i,
  /looked around/i,
  /changed a bit/i,
  /trying/i,
  /continuing/i,
  /^wip$/i,
]

export function getDefaultSessionSyncState(sessionId: string, issueId: string, now: string): SessionSyncState {
  return {
    sessionId,
    issueId,
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
    createdAt: now,
    updatedAt: now,
  }
}

function normalizeSummary(summary: string): string {
  return summary.trim().replace(/\s+/g, " ").toLowerCase()
}

function isVagueSummary(summary: string): boolean {
  const normalized = normalizeSummary(summary)
  if (normalized.length < MIN_SUMMARY_LENGTH) {
    return true
  }

  return VAGUE_PATTERNS.some((pattern) => pattern.test(normalized))
}

function isMilestoneSummary(summary: string): boolean {
  return /(completed|finished|implemented|fixed|resolved|split|prepared|validated|delivered|added)/i.test(summary)
}

function minutesBetween(startIso: string, endIso: string): number {
  return Math.max(0, new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000
}

export function computeSyncFingerprint(issueId: string, kind: SyncKind, summary: string): string {
  return `${issueId}:${kind}:${normalizeSummary(summary)}`
}

export function evaluateSyncCheckpoint(input: EvaluateSyncCheckpointInput): SyncCheckpointResult {
  const summary = input.summary.trim()
  if (!summary || isVagueSummary(summary)) {
    return { shouldSync: false, reason: "no-op", kind: null, fingerprint: null }
  }

  const hintedKind = input.kindHint && input.kindHint !== "auto" ? input.kindHint : null
  const kind: SyncKind = hintedKind ?? (isMilestoneSummary(summary) ? "progress" : "progress")
  const fingerprint = computeSyncFingerprint(input.syncState.issueId, kind, summary)

  if (fingerprint === input.syncState.lastSyncFingerprint) {
    return { shouldSync: false, reason: "duplicate", kind, fingerprint }
  }

  if (input.force) {
    return { shouldSync: true, reason: "forced", kind, fingerprint }
  }

  if (hintedKind === "note" || input.syncState.pendingDecision) {
    return { shouldSync: true, reason: "decision", kind: "note", fingerprint: computeSyncFingerprint(input.syncState.issueId, "note", summary) }
  }

  if (input.syncState.lastSyncedAt) {
    const elapsedMinutes = minutesBetween(input.syncState.lastSyncedAt, input.now)
    if (elapsedMinutes >= TIMEOUT_MINUTES) {
      return { shouldSync: true, reason: "timeout", kind: "progress", fingerprint: computeSyncFingerprint(input.syncState.issueId, "progress", summary) }
    }
  }

  if (isMilestoneSummary(summary) || input.syncState.pendingMilestone) {
    return { shouldSync: true, reason: "milestone", kind: "progress", fingerprint: computeSyncFingerprint(input.syncState.issueId, "progress", summary) }
  }

  return { shouldSync: false, reason: "no-op", kind: null, fingerprint: null }
}

export function createSyncCandidateContent(input: CreateSyncCandidateContentInput): string {
  const header = input.kind === "progress" ? "### Progress Update" : "### Note"

  return [
    header,
    "",
    `Session: ${input.sessionId}`,
    `Time: ${input.now}`,
    "",
    input.summary.trim(),
  ].join("\n")
}
