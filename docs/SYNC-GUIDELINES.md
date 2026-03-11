# Linear Progress Sync Guidelines

This document defines the progress sync standards for Agents using the Linear Workflow.

## Core Principles

**Quality > Frequency**

- One meaningful sync every 30-45 minutes is better than trivial updates every 5 minutes
- Sync content should help your future self or others quickly understand the current state

## Sync Triggers (SYNC Checkpoints)

### ✅ MUST Sync

| Scenario | Sync Type | Content Requirements |
|----------|-----------|---------------------|
| Complete major sub-task/milestone | `progress` | Achievement summary, key code/file locations |
| Make architectural decision | `note` | Decision content, alternatives considered, rationale |
| Discover major blocker or need to pivot | `progress` | Problem description, current approach, help/decisions needed |
| Working 30-45 minutes without sync | `progress` | Summary of main work completed during the period |
| Before switching context | `progress` | Current status, incomplete items, resumption point |
| Before submitting for review | `progress` | Completed features, test status, known limitations |

### ❌ DON'T Sync

- Routine file reads (unless critical information discovered)
- Single file edits or operations
- Debugging trial-and-error steps
- Formatting or code refactoring
- "Working on..." status updates without concrete outcomes

## Sync Content Formats

### Progress Type Template

```markdown
### Progress: [Short Title]

**Completed:**
- [Concrete outcome 1]
- [Concrete outcome 2]

**Key Changes:**
- `file/path`: Brief description of change
- `file/path`: Brief description of change

**Status:** [Current completion / Next steps]
```

### Note Type Template

```markdown
### Note: [Decision/Discovery Title]

**Context:** [Context of the issue]

**Decision/Discovery:** [Decision made or finding]

**Rationale:** [Why this approach]

**Impact:** [Effect on related modules / future work]
```

## Examples

### ✅ Good Sync Examples

**Progress Example:**
```
Completed database migration script implementation

- Created migration_v2.py supporting data structure conversion from v1 to v2
- Added rollback logic and integrity checks
- Test passed: 1000 records migrated in 2.3s

Key files:
- migrations/migration_v2.py: Main migration logic
- tests/test_migration.py: Unit tests

Next: Staging environment testing after code review
```

**Note Example:**
```
Decision: Use Redis instead of Memcached as cache layer

Context: Current Memcached cannot meet distributed locking requirements

Decision: Introduce Redis using Redlock algorithm for distributed locking

Rationale:
- Redis supports atomic operations and Lua scripts
- Team already has Redis operational experience
- Redlock is sufficiently reliable for most scenarios

Impact: Need to update deployment configuration and monitoring alerts
```

### ❌ Bad Sync Examples

```
Working on it
```

```
Modified auth.ts
```

```
Having issues, still debugging
```

## Memory Rules

If you realize you're doing any of the following, it's time to consider syncing:

1. **"This is an important turning point"** → Sync the decision
2. **"Finally solved this difficult problem"** → Sync the achievement
3. **"Been working for 30 minutes"** → Sync the progress
4. **"Others need to know about this"** → Sync the information

## Tool Integration

- Use the `linear_sync_comment` tool for syncing
- Parameter `kind`:
  - `"progress"` - For achievements and milestones
  - `"note"` - For decisions, discoveries, observations
- Content is automatically formatted as Markdown with timestamps appended
