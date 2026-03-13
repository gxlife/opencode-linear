---
description: Mark current Linear issue as In Review
---

You are running the `/issue-review` command for opencode-linear.

## Must do:

1. **Run a forced checkpoint** before state change (CRITICAL):
   - Call `linear_workflow_checkpoint` with:

```json
{
  "summary": "Provide a concise summary of the implementation results, decisions, testing status, and caveats.",
  "force": true
}
```

   - If the tool returns `shouldSync: true`, immediately call `linear_sync_comment` with the returned `content` and `kind`

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
