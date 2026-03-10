# OpenCode Linear Plugin

**Generated:** 2026-03-11  
**Commit:** 548a9bf  
**Branch:** main

## OVERVIEW
OpenCode plugin for Linear issue workflow. Two-layer design: plugin layer (runtime tools) + command layer (slash command templates).

## STRUCTURE
```
.
├── src/
│   ├── index.ts          # Main plugin: 6 tools + hooks
│   ├── state.ts          # SQLite session persistence
│   └── utils/
│       └── project-id.ts # Git-based project ID for worktree support
├── commands/             # Slash command templates (OpenCode commands/)
│   ├── issue-start.md
│   ├── issue-review.md
│   ├── issue-close.md
│   └── issue-cancel.md
├── scripts/
│   ├── postinstall.js    # Auto-setup commands + plugin symlink
│   └── preuninstall.js   # Cleanup on uninstall
├── docs/ARCHITECTURE.md  # Plugin + command architecture
└── examples/linear-workflow.json
```

## WHERE TO LOOK
| Task | Location |
|------|----------|
| Add/modify tool | `src/index.ts` - `tool: { ... }` object |
| Session state | `src/state.ts` - SQLite schema + CRUD |
| Project ID logic | `src/utils/project-id.ts` - git root commit hash |
| Slash command behavior | `commands/*.md` - frontmatter + instructions |
| Install automation | `scripts/postinstall.js` |
| Architecture docs | `docs/ARCHITECTURE.md` |

## CONVENTIONS
- **TypeScript**: ES modules, Bun runtime, strict mode
- **Database**: SQLite via `bun:sqlite`, WAL mode, busy_timeout=5000
- **Config**: `.opencode/linear-workflow.json` or `~/.config/opencode/linear-workflow.json`
- **State**: `~/.local/share/opencode/plugins/linear-workflow/{project-id}.sqlite`
- **CLI**: All Linear operations via `linear` CLI wrapper

## TOOLS EXPOSED
| Tool | Purpose |
|------|---------|
| `linear_workflow_start` | Bind/create issue, auto-promote state |
| `linear_workflow_update` | Update state (in_progress/in_review/completed/canceled) |
| `linear_sync_comment` | Post progress/note comments to bound issue |
| `linear_get_current_issue` | Get current session's bound issue |
| `linear_workflow_list` | List issues with project/team filters |
| `linear_workflow_config` | View/set/clear workflow config |

## STATE MACHINE
Linear states are normalized via fallback candidates:
- `in_progress`: started, in progress, inprogress
- `in_review`: in review, review, ready review, ready for review
- `completed`: completed, done
- `canceled`: canceled, cancelled

Auto-promotion on start: backlog → in_progress (configurable via `shouldAutoPromote`)

## ANTI-PATTERNS
- **Don't** call Linear CLI directly without `runLinear()` wrapper
- **Don't** modify `state.ts` schema without migration plan
- **Don't** store absolute paths in SQLite (use project-relative)
- **Don't** skip config file caching in `loadConfig()`

## COMMANDS
```bash
npm run build      # tsc compile
npm run check      # tsc --noEmit
npm run fmt        # prettier --write .
npm run lint       # eslint src/**/*.ts
```

## NOTES
- Uses Bun.spawn for CLI execution
- Comments posted via temp files (body-file flag)
- Project ID uses first git root commit SHA for worktree consistency
- Issue ID format: `^[A-Z][A-Z0-9]+-\d+$` (e.g., ENG-123)
