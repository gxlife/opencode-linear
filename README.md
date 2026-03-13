# OpenCode Linear Plugin

[![npm version](https://img.shields.io/npm/v/opencode-linear.svg)](https://www.npmjs.com/package/opencode-linear)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> 🌐 [English](README.md) | [简体中文](README.zh-CN.md)

Seamlessly manage Linear workflows in OpenCode. Automatically sync session state, track progress, and drive issue lifecycle without leaving your editor.

## ✨ Workflow in Action

```bash
# Bind an existing issue or create from text
/issue-start ENG-123
# → Auto-linked, state transitions: backlog → in_progress

# Or use natural language
/issue-start "Refactor auth module to support OAuth2"
# → Intelligently matches existing issues or creates new

# Focus on coding, progress syncs to Linear automatically
# ...Your conversations and task completions are recorded...

# State transitions feel natural
/issue-review      # → in_review
/issue-done        # → completed  
/issue-cancel      # → canceled
```

## 🎯 Key Features

| Feature | Description |
|---------|-------------|
| **Session Persistence** | SQLite storage for session-issue binding, survives across conversations |
| **Smart Issue Matching** | `/issue-start` prioritizes existing issues, prevents duplicates |
| **Auto State Promotion** | backlog/todo automatically moves to in_progress, no manual clicks |
| **Checkpoint-Based Sync** | Meaningful work segments trigger checkpoint evaluation before syncing comments |
| **Worktree Aware** | Git worktrees share the same project ID, data stays consolidated |
| **Zero-Config Defaults** | Works out of the box with sensible defaults |

## 🚀 Quick Start

### Prerequisites

```bash
# 1. Install Linear CLI and authenticate
npm install -g @schpet/linear-cli
linear auth login

# 2. Install the plugin
npm install -g opencode-linear
# postinstall automatically configures commands and plugin
```

### Getting Started

```bash
# Option 1: Bind an existing issue
/issue-start PROJ-123

# Option 2: Describe your need, smart match or create
/issue-start "Optimize database query performance"

# Check current binding
What is my current Linear issue?
```

## ⚙️ Configuration (Optional)

Create `.opencode/linear-workflow.json`:

```json
{
  "project": "YourProject",
  "team": "Engineering", 
  "labels": ["agent-workflow"],
  "defaultState": "backlog"
}
```

Configuration precedence:
1. `./.opencode/linear-workflow.json`
2. `~/.config/opencode/linear-workflow.json`

## 🔧 Tools Provided

| Tool | Purpose |
|------|---------|
| `linear_workflow_create_issue` | Create a new issue from task text and config defaults |
| `linear_workflow_bind_issue` | Bind an issue to the current session and auto-promote when needed |
| `linear_workflow_update` | Update state (in_progress/in_review/completed/canceled) |
| `linear_workflow_checkpoint` | Decide whether a completed work segment should sync to Linear |
| `linear_sync_comment` | Add comment to current bound issue |
| `linear_workflow_sync_status` | Show current sync checkpoint state for the session |
| `linear_get_current_issue` | Get current session's bound issue |
| `linear_workflow_list` | List existing issues (supports project/team filters) |
| `linear_workflow_config` | View/modify workflow configuration |

## 📝 Command Reference

### `/issue-start <issue-id-or-text>`

The smartest entry point:

1. **Input is issue ID** (e.g., `ENG-123`): Directly bind that issue
2. **Input is description text**:
   - Creates a new issue from the first-line title and full description
   - Binds the created issue to the current session

### Automatic Sync Checkpoints

After a meaningful work segment finishes, the agent should:

1. Call `linear_workflow_checkpoint` with a concise summary
2. If `shouldSync` is `true`, call `linear_sync_comment`
3. Reply to the user after the sync completes

`/issue-review` and `/issue-done` also run a forced checkpoint before changing issue state.

### State Transition Commands

```bash
/issue-review   # Mark as review state
/issue-done     # Mark as completed
/issue-cancel   # Mark as canceled
```

## 🏗️ Architecture

Two-layer design:
- **Plugin Layer** (`src/`): Provides runtime tools and SQLite-backed session state
- **Command Layer** (`commands/`): OpenCode slash command templates

Detailed architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## 💻 Local Development

```bash
git clone https://github.com/gxlife/opencode-linear.git
cd opencode-linear
npm install
npm run build

# Manual link to OpenCode
mkdir -p ~/.config/opencode/plugins ~/.config/opencode/commands
ln -sf $(pwd)/dist/index.js ~/.config/opencode/plugins/opencode-linear.js
cp -r $(pwd)/commands/* ~/.config/opencode/commands/
```

### Development Commands

```bash
npm run build      # Compile TypeScript
npm run check      # Type check
npm run fmt        # Format code
npm run lint       # Lint code
```

## 📦 Technical Details

- **Runtime**: Bun (uses `bun:sqlite` for persistence)
- **State Storage**: `~/.local/share/opencode/plugins/linear-workflow/{project-id}.sqlite`
- **Project ID**: Git first root commit SHA (supports worktrees)
- **Issue ID Format**: `^[A-Z][A-Z0-9]+-\d+$` (e.g., ENG-123)

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT
