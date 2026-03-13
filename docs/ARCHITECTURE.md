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
2. Command template decides whether to call `linear_workflow_bind_issue` directly or create via `linear_workflow_create_issue` first
3. Plugin executes tool logic in `src/index.ts`
4. Tools read/write session and sync-checkpoint state in SQLite via `src/state.ts`
5. After meaningful work, command templates call `linear_workflow_checkpoint` before replying
6. If checkpoint says sync is needed, `linear_sync_comment` posts the comment to Linear
7. Output is returned to user

## Plugin Layer

### Tools

- `linear_workflow_create_issue`
- `linear_workflow_bind_issue`
- `linear_workflow_update`
- `linear_workflow_checkpoint`
- `linear_sync_comment`
- `linear_workflow_sync_status`
- `linear_get_current_issue`
- `linear_workflow_list`
- `linear_workflow_config`

### Sync Model

- Session-to-issue binding is stored in SQLite
- Sync checkpoint metadata is stored alongside session state
- Commands trigger explicit checkpoint evaluation after meaningful work and before review/done transitions
- Linear comments are posted by `linear_sync_comment` after checkpoint approval

## Command Layer

Provided command files:

- `commands/issue-start.md`
- `commands/issue-review.md`
- `commands/issue-done.md`
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
    issue-done.md
    issue-cancel.md
  examples/linear-workflow.json
```

## Packaging

`package.json` includes `commands/` in published files so users can copy commands after `npm install -g opencode-linear`.
