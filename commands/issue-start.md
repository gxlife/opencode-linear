---
description: Start Linear workflow from issue id or requirement text
---

You are running the `/issue-start` command for opencode-linear.

## Action requirements:

1. Read command arguments from `$ARGUMENTS`.
2. If `$ARGUMENTS` is empty, tell the user to run `/issue-start <issue-id-or-text>`.

3. Parse `$ARGUMENTS` to extract issue ID and task description:
   - **Format A**: `ENG-123` - Just the issue ID
   - **Format B**: `ENG-123 implement user login with JWT` - Issue ID followed by task description
   - **Format C**: `implement user login with JWT` - Just task description (no issue ID)

4. If an issue ID was found (Format A or B):
   - Call `linear_workflow_start` with the combined input: `"$ARGUMENTS"`
   - This will bind the existing issue and use the task description (if provided) as the task prompt

5. If no issue ID was found (Format C):
   - First, try to find and bind an existing issue:
     - Call `linear_workflow_list` to fetch candidate issues (limit: 30-50)
     - Match candidates using the task description semantics
     - If there is one clear best match, call `linear_workflow_start` with that issue id
   - If matching confidence is low or there are multiple similarly good candidates:
     - Ask the user whether to bind one of the candidate issue ids, or create a new issue
     - Provide a short candidate list and ask user to reply with an issue id or "create"
   - If no suitable issue is found, call `linear_workflow_start` with the task description to create a new issue

6. Return the tool result and a concise next step.

## Progress Sync Guidelines (CRITICAL - YOU MUST FOLLOW THIS):

After successfully binding an issue, you MUST periodically sync meaningful progress to Linear using `linear_sync_comment`.

### When to sync (MUST):
- ✅ **Complete a major milestone** - A sub-task is done, a feature is working
- ✅ **Make an architectural decision** - You chose approach A over B
- ✅ **Encounter a blocker** - Something is blocking progress, need to change approach
- ✅ **Every 30-45 minutes** - Time-based sync if no milestone sync yet
- ✅ **Before context switch** - Before switching to another task or taking a break
- ✅ **Before review/close** - Before marking issue as in_review or completed

### What NOT to sync:
- ❌ Routine file reads (unless it reveals critical information)
- ❌ Single file edits or formatting changes
- ❌ Debug attempts or error messages (unless root cause found)
- ❌ "Working on..." without concrete outcomes
- ❌ Anything you'd skip when writing a daily standup update

### How to sync:

**Use `linear_sync_comment` with appropriate `kind`:**

```json
{
  "content": "Your sync message here",
  "kind": "progress"  // or "note"
}
```

**`kind: "progress"` - Use when:**
- You completed something concrete
- You reached a milestone
- You're reporting status before review/close

**Format:**
```
### Progress: [What was accomplished]

**Completed:**
- [Specific outcome 1]
- [Specific outcome 2]

**Key changes:**
- `path/to/file.ts`: Brief description of change
- `path/to/file.ts`: Brief description of change

**Status:** [What's next / current blockers]
```

**`kind: "note"` - Use when:**
- You made a decision
- You discovered something important
- You need to document context for future reference

**Format:**
```
### Note: [Decision/Discovery title]

**Context:** [Why this matters]

**Decision/Discovery:** [What you decided or found]

**Rationale:** [Why this approach]

**Impact:** [Effect on the project]
```

### Examples of good sync:

**Progress example:**
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

**Note example:**
```
Decision: Use Redis instead of Memcached

Context: Current Memcached cannot meet distributed locking requirements

Decision: Introduce Redis using Redlock algorithm

Rationale:
- Redis supports atomic operations and Lua scripts
- Team already has Redis operational experience

Impact: Need to update deployment configuration
```

### Examples of bad sync (DON'T DO THIS):

❌ "Working on it"
❌ "Modified auth.ts"
❌ "Having issues, still debugging"
❌ "Read config.ts file"

### Self-check before continuing:

If you haven't called `linear_sync_comment` in the last 20-30 minutes of active work, STOP and sync now.

**Ask yourself:**
- Did I just complete something meaningful? → Sync as progress
- Did I just make an important decision? → Sync as note
- Have I been working for 30+ minutes without syncing? → Sync current status
- Would I mention this in a standup? → If yes, sync it

**Remember: Quality > Quantity. One meaningful sync per 30-45 minutes is better than constant noise.**
