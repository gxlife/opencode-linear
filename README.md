# OpenCode Linear Plugin

[![npm version](https://img.shields.io/npm/v/opencode-linear.svg)](https://www.npmjs.com/package/opencode-linear)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Linear issue workflow plugin for [OpenCode](https://opencode.ai/). Automatically sync your development tasks with Linear, track progress, and manage issue lifecycle without leaving your editor.

## ✨ Features

- 🎯 **Auto-bind Sessions**: Link OpenCode sessions to Linear issues
- 📝 **Progress Sync**: Automatically sync task progress to Linear comments
- 🔄 **State Management**: Update issue states (In Progress → In Review → Done)
- ⚙️ **Project Filtering**: Configure default project/team/labels
- 🤖 **Smart Detection**: Intent-based workflow suggestions

## 📦 Installation

### Prerequisites

- [OpenCode](https://opencode.ai/) installed
- [Linear CLI](https://github.com/schpet/linear-cli) installed globally:
  ```bash
  npm install -g @schpet/linear-cli
  linear auth login  # Authenticate with Linear
  ```

### Install Plugin

```bash
npm install -g opencode-linear
```

Then add to your `~/.config/opencode/opencode.json`:

```json
{
  "plugin": [
    "opencode-linear"
  ]
}
```

## 🚀 Usage

### Slash Commands

| Command | Description |
|---------|-------------|
| `/issue-start <text>` | Create or link to an issue |
| `/issue-review` | Mark current issue as "In Review" |
| `/issue-close` | Mark current issue as "Completed" |
| `/issue-cancel` | Mark current issue as "Canceled" |

### Configuration

Create `.opencode/linear-workflow.json` in your project:

```json
{
  "project": "YourProject",
  "team": "Engineering",
  "labels": ["agent-workflow"],
  "defaultState": "backlog"
}
```

Or globally at `~/.config/opencode/linear-workflow.json`.

### Example Workflow

```
User: /issue-start Implement user authentication
     ↓
Agent: Creates Linear issue "Implement user authentication"
       Issue BYR-42 created, session bound
       State: Backlog → In Progress
     ↓
Agent: Works on the task
       Progress auto-synced to BYR-42 comments
     ↓
User: /issue-review
     ↓
Agent: Updates BYR-42 state to "In Review"
```

## 🔧 Available Tools

The plugin provides these tools for agent use:

- `linear_workflow_start` - Start a workflow from issue ID or text
- `linear_workflow_update` - Update issue state
- `linear_sync_comment` - Manually sync a comment
- `linear_get_current_issue` - Get bound issue info
- `linear_workflow_list` - List issues with filters
- `linear_workflow_config` - View/update configuration

## 🏗️ Development

```bash
# Clone the repository
git clone https://github.com/gxlife/opencode-linear.git
cd opencode-linear

# Install dependencies
npm install

# Type check
npm run check

# Build
npm run build

# Format code
npm run fmt
```

## 📄 License

MIT © [gxlife](https://github.com/gxlife)

## 🤝 Contributing

Contributions welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) for details.

---

Made with ❤️ for the OpenCode community
