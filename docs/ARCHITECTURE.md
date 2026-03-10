# Architecture: Plugin + Commands

## Overview

`opencode-linear` uses a two-layer design:

1. **Plugin layer** (`src/`): provides runtime tools and hooks
2. **Command layer** (`commands/`): provides slash-command entrypoints via OpenCode official commands system

This replaces the previous skill-based command mapping.

## Why Commands Instead of Skills

- OpenCode already has first-class command support via `~/.config/opencode/commands/` and `.opencode/commands/`.
- Slash command behavior belongs to command templates.
- Plugin remains focused on tool execution and integrations.

Reference: `https://opencode.ai/docs/zh-cn/commands/`

## Runtime Flow

Example: `/issue-start ENG-123`

1. OpenCode resolves `commands/issue-start.md`
2. Command template instructs model to call `linear_workflow_start`
3. Plugin executes tool logic in `src/index.ts`
4. Tool reads/writes session state in SQLite via `src/state.ts`
5. Output is returned to user

## Plugin Layer

### Tools

- `linear_workflow_start`
- `linear_workflow_update`
- `linear_sync_comment`
- `linear_get_current_issue`
- `linear_workflow_list`
- `linear_workflow_config`

### Hooks

- `chat.message`: syncs user message to bound issue comment
- `tool.execute.after`: syncs task completion to bound issue

## Command Layer

Provided command files:

- `commands/issue-start.md`
- `commands/issue-review.md`
- `commands/issue-close.md`
- `commands/issue-cancel.md`

Each command file is a markdown template with frontmatter and directs model behavior to invoke the correct plugin tool.

## File Layout

```text
opencode-linear/
  src/
    index.ts
    state.ts
    utils/project-id.ts
  commands/
    issue-start.md
    issue-review.md
    issue-close.md
    issue-cancel.md
  examples/linear-workflow.json
```

## Packaging

`package.json` includes `commands/` in published files so users can copy commands after `npm install -g opencode-linear`.
