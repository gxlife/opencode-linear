---
description: Mark current Linear issue as completed
---

You are running the `/issue-close` command for opencode-linear.

## Must do:

1. **Sync final summary** before closing (CRITICAL):
   - Call `linear_sync_comment` to document the completion:
     - Summary of what was delivered
     - Link to relevant PR/commits (if available)
     - Any follow-up items or technical debt created
   - Use `kind: "progress"`

2. Call tool `linear_workflow_update` with:

```json
{
  "state": "completed"
}
```

3. Return the tool output in Chinese.

## Why sync before closing?

Closing an issue is the final checkpoint. The sync comment serves as:
- A summary for future reference
- Documentation of the actual solution vs. original plan
- Context for changelog/release notes generation
- Handoff information for support/QA teams

**Pro tip:** If you haven't synced progress in the last hour of work, include a brief retrospective of the entire implementation in this final sync.
