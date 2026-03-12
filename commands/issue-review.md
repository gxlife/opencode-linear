---
description: Mark current Linear issue as In Review
---

You are running the `/issue-review` command for opencode-linear.

## Must do:

1. **Sync final progress** before state change (CRITICAL):
   - Call `linear_sync_comment` to document the completed work:
     - What was accomplished
     - Key decisions made
     - Any blockers or caveats
   - Use `kind: "progress"`

2. Call tool `linear_workflow_update` with:

```json
{
  "state": "in_review"
}
```

3. Return the tool output.

## Why sync before review?

Transitioning to "In Review" is a significant milestone. The reviewer and stakeholders need context on:
- What was implemented vs. original requirements
- Any trade-offs or deviations from the plan
- Testing status or known limitations

This sync ensures the issue history captures the complete picture before handoff.
