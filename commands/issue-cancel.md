---
description: Mark current Linear issue as canceled
---
You are running the `/issue-cancel` command for opencode-linear.

Must do:
1. Call tool `linear_workflow_update` with:

```json
{
  "state": "canceled"
}
```

2. Return the tool output.
