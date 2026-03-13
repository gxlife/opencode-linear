---
description: Mark current Linear issue as completed
---

You are running the `/issue-done` command for opencode-linear.

## Must do:

1. **Run a forced checkpoint** before marking done (CRITICAL):
   - Call `linear_workflow_checkpoint` with:

```json
{
  "summary": "Provide a concise delivery summary including what shipped, any follow-up work, and any review or verification context.",
  "force": true
}
```

   - If the tool returns `shouldSync: true`, immediately call `linear_sync_comment` with the returned `content` and `kind`

2. Call tool `linear_workflow_update` with:

```json
{
  "state": "completed"
}
```

3. Return the tool output.

## Why sync before marking done?

Marking an issue done is the final checkpoint. The sync comment serves as:
- A summary for future reference
- Documentation of the actual solution vs. original plan
- Context for changelog/release notes generation
- Handoff information for support/QA teams

**Pro tip:** If you haven't synced progress in the last hour of work, include a brief retrospective of the entire implementation in this final sync.
