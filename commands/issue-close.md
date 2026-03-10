---
description: Mark current Linear issue as completed
---
You are running the `/issue-close` command for opencode-linear.

Must do:
1. Call tool `linear_workflow_update` with:

```json
{
  "state": "completed"
}
```

2. Return the tool output in Chinese.
