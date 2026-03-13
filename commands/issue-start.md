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
   - Extract the issue ID (e.g., `ENG-123`)
   - Extract any additional task description text (if present in Format B)
   - Call `linear_workflow_bind_issue` with:
     - `issueId`: the extracted issue ID
     - `taskDescription`: any additional description text (can be empty)
   - The tool will:
     - Validate the issue exists
     - Update state to `in_progress` (if currently in backlog/todo)
     - Bind the issue to current session
     - Return a `TASK_PROMPT` for execution
   - **Proceed with the returned TASK_PROMPT** - do not ask user for confirmation

5. If no issue ID was found (Format C):
   - Extract the task title from the first line of input
   - Call `linear_workflow_create_issue` with:
     - `title`: the extracted title (max 120 chars)
     - `description`: the full input text as description
   - The tool will create a new issue and return the issue details including `issueId`
   - **Immediately** call `linear_workflow_bind_issue` with:
     - `issueId`: the newly created issue ID from the previous step
     - `taskDescription`: "" (empty, since the description is already in the issue)
   - The tool will bind the newly created issue to the session and return a `TASK_PROMPT`
   - **Proceed with the returned TASK_PROMPT** - do not ask user for confirmation

6. **Execute the task**: Once you have the `TASK_PROMPT` from either step 4 or 5, immediately start working on it. Do not ask the user "what would you like me to do" - the task description is already provided.

7. **Before replying after meaningful work**, call `linear_workflow_checkpoint` with a concise summary of what was just completed.
   - Use this after a meaningful work segment such as:
     - implementation completed for a sub-task
     - bug root cause confirmed and fixed
     - a stable architectural or workflow decision was made
     - a long analysis produced a final conclusion
   - Do **not** call it for routine file reads, vague WIP updates, or inconclusive trial-and-error.
   - If the tool returns `shouldSync: true`, immediately call `linear_sync_comment` with:
     - `content`: the returned `content`
     - `kind`: the returned `kind`
   - Only after that should you reply to the user.

## Summary of tool calls:

**With issue ID:**
```
linear_workflow_bind_issue({ issueId: "ENG-123", taskDescription: "additional context" })
→ Returns TASK_PROMPT
→ Execute TASK_PROMPT immediately
```

**Without issue ID:**
```
linear_workflow_create_issue({ title: "Task title", description: "Full description" })
→ Returns { issueId: "ENG-124", ... }
linear_workflow_bind_issue({ issueId: "ENG-124", taskDescription: "" })
→ Returns TASK_PROMPT
→ Execute TASK_PROMPT immediately
```

**After meaningful work is completed:**
```
linear_workflow_checkpoint({
  summary: "Completed the command flow split and wired checkpoint support into issue-start.",
  kindHint: "auto"
})
→ Returns { shouldSync, kind, content, reason }
→ If shouldSync=true, call linear_sync_comment({ content, kind })
→ Then reply to the user
```

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
