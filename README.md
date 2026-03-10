# OpenCode Linear Plugin

[![npm version](https://img.shields.io/npm/v/opencode-linear.svg)](https://www.npmjs.com/package/opencode-linear)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Linear issue workflow plugin for [OpenCode](https://opencode.ai/).

This project now uses **OpenCode Commands** for slash commands, not skills.

## Features

- Session binding with Linear issues
- Issue lifecycle updates (in progress / in review / completed / canceled)
- Automatic comment sync from conversation and delegated tasks
- Project/team/labels/default-state config support

## Prerequisites

- OpenCode installed
- Linear CLI installed and authenticated

```bash
npm install -g @schpet/linear-cli
linear auth login
```

## Install

```bash
npm install -g opencode-linear
```

`postinstall` will automatically:

- copy `commands/*.md` to `~/.config/opencode/commands/`
- ensure `opencode-linear` exists in `~/.config/opencode/opencode.json` `plugin` array

After install, you can directly use:

- `/issue-start <issue-id-or-text>`
- `/issue-review`
- `/issue-close`
- `/issue-cancel`

`/issue-start` behavior:

- prefer binding an existing issue inferred from user input
- ask user to choose bind-or-create when matching is ambiguous
- create a new issue only when no suitable existing issue is found

If you want to skip automatic setup:

```bash
OPENCODE_LINEAR_SKIP_POSTINSTALL=1 npm install -g opencode-linear
```

Uninstall will automatically clean up the resources installed by this package:

- remove copied `commands/issue-*.md` under `~/.config/opencode/commands/`
- remove `~/.config/opencode/plugin/opencode-linear.js`
- remove `opencode-linear` from `~/.config/opencode/opencode.json` `plugin` array

Manual config (only needed when postinstall is skipped):

```json
{
  "plugin": ["opencode-linear"]
}
```

## Local Dev Install

```bash
git clone https://github.com/gxlife/opencode-linear.git
cd opencode-linear
npm install
npm run build

mkdir -p ~/.config/opencode/plugins ~/.config/opencode/commands
ln -sf $(pwd)/dist/index.js ~/.config/opencode/plugins/opencode-linear.js
cp -r $(pwd)/commands/* ~/.config/opencode/commands/
```

## Configuration

Create `.opencode/linear-workflow.json` (project-level) or `~/.config/opencode/linear-workflow.json` (global):

```json
{
  "project": "YourProject",
  "team": "Engineering",
  "labels": ["agent-workflow"],
  "defaultState": "backlog"
}
```

## Tools Exposed by Plugin

- `linear_workflow_start`
- `linear_workflow_update`
- `linear_sync_comment`
- `linear_get_current_issue`
- `linear_workflow_list`
- `linear_workflow_config`

## Commands Included

- `commands/issue-start.md`
- `commands/issue-review.md`
- `commands/issue-close.md`
- `commands/issue-cancel.md`

## Development

```bash
npm install
npm run check
npm run build
```

See `docs/ARCHITECTURE.md` for plugin + command architecture.

## License

MIT
