---
description: Start Linear workflow from issue id or requirement text
---
You are running the `/issue-start` command for opencode-linear.

Action requirements:
1. Read command arguments from `$ARGUMENTS`.
2. If `$ARGUMENTS` is empty, tell the user to run `/issue-start <issue-id-or-text>`.
3. If `$ARGUMENTS` looks like a Linear issue id (for example `ENG-123`), call tool `linear_workflow_start` directly with:

```json
{
  "input": "$ARGUMENTS"
}
```

4. If `$ARGUMENTS` is not an issue id, first try to bind an existing issue:
   - Call `linear_workflow_list` to fetch candidate issues (use a practical limit such as 30-50).
   - Match candidates using `$ARGUMENTS` semantics (title, key terms, obvious intent).
   - If there is one clear best match, call `linear_workflow_start` with that issue id.
5. If matching confidence is low or there are multiple similarly good candidates, ask the user:
   - whether to bind one of the candidate issue ids,
   - or create a new issue.
   Provide a short candidate list and ask user to reply with an issue id or "create".
6. If no suitable issue is found, call `linear_workflow_start` with `$ARGUMENTS` to create a new issue.
7. Return the tool result and a concise next step.
