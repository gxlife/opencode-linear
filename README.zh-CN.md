# OpenCode Linear Plugin

[![npm version](https://img.shields.io/npm/v/opencode-linear.svg)](https://www.npmjs.com/package/opencode-linear)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> 🌐 [English](README.md) | [简体中文](README.zh-CN.md)

在 OpenCode 中无缝管理 Linear 工作流。自动同步会话状态、追踪进度、推进 issue 生命周期，无需离开编辑器。

## ✨ 工作流演示

```bash
# 绑定现有 issue 或从文本创建
/issue-start ENG-123
# → 自动关联，状态从 backlog → in_progress

# 或直接用自然语言
/issue-start "重构用户认证模块，支持 OAuth2"
# → 智能匹配现有 issue 或创建新 issue

# 专注编码，自动同步进度到 Linear
# ...你的对话和任务完成会自动记录...

# 状态流转自然无缝
/issue-review      # → in_review
/issue-close       # → completed  
/issue-cancel      # → canceled
```

## 🎯 核心特性

| 特性 | 说明 |
|------|------|
| **会话持久化** | SQLite 存储 session-issue 绑定，跨对话不丢失 |
| **智能 issue 匹配** | `/issue-start` 优先匹配现有 issue，避免重复创建 |
| **自动状态推进** | backlog/todo 自动进入 in_progress，无需手动点击 |
| **自动评论同步** | 对话内容和任务完成自动同步到 Linear 评论 |
| **Worktree 感知** | Git worktree 共享同一 project ID，数据不分散 |
| **零配置启动** | 安装即用，默认配置覆盖常见场景 |

## 🚀 快速开始

### 前置条件

```bash
# 1. 安装 Linear CLI 并登录
npm install -g @schpet/linear-cli
linear auth login

# 2. 安装插件
npm install -g opencode-linear
# postinstall 自动配置 commands 和 plugin
```

### 开始使用

```bash
# 方式1: 绑定现有 issue
/issue-start PROJ-123

# 方式2: 描述需求，智能匹配或创建
/issue-start "优化数据库查询性能"

# 查看当前绑定
What is my current Linear issue?
```

## ⚙️ 配置（可选）

创建 `.opencode/linear-workflow.json`：

```json
{
  "project": "YourProject",
  "team": "Engineering", 
  "labels": ["agent-workflow"],
  "defaultState": "backlog"
}
```

配置位置优先级：
1. `./.opencode/linear-workflow.json`
2. `~/.config/opencode/linear-workflow.json`

## 🔧 提供的工具

| 工具 | 用途 |
|------|------|
| `linear_workflow_start` | 绑定/创建 issue，自动推进状态 |
| `linear_workflow_update` | 更新状态 (in_progress/in_review/completed/canceled) |
| `linear_sync_comment` | 添加评论到当前绑定 issue |
| `linear_get_current_issue` | 获取当前会话绑定的 issue |
| `linear_workflow_list` | 列出现有 issue（支持 project/team 过滤）|
| `linear_workflow_config` | 查看/修改工作流配置 |

## 📝 命令详解

### `/issue-start <issue-id-or-text>`

最智能的入口命令：

1. **输入是 issue ID**（如 `ENG-123`）：直接绑定该 issue
2. **输入是描述文本**：
   - 先搜索现有 issue 进行语义匹配
   - 匹配度高 → 提示用户选择绑定
   - 匹配度低/无匹配 → 创建新 issue

### 状态流转命令

```bash
/issue-review   # 标记为 review 状态
/issue-close    # 标记为已完成
/issue-cancel   # 标记为已取消
```

## 🏗️ 架构说明

双分层设计：
- **Plugin 层** (`src/`): 提供 runtime tools 和 hooks
- **Command 层** (`commands/`): OpenCode slash 命令模板

详细架构见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## 💻 本地开发

```bash
git clone https://github.com/gxlife/opencode-linear.git
cd opencode-linear
npm install
npm run build

# 手动链接到 OpenCode
mkdir -p ~/.config/opencode/plugins ~/.config/opencode/commands
ln -sf $(pwd)/dist/index.js ~/.config/opencode/plugins/opencode-linear.js
cp -r $(pwd)/commands/* ~/.config/opencode/commands/
```

### 开发命令

```bash
npm run build      # 编译 TypeScript
npm run check      # 类型检查
npm run fmt        # 格式化代码
npm run lint       # 代码检查
```

## 📦 技术细节

- **运行时**: Bun (使用 `bun:sqlite` 持久化)
- **状态存储**: `~/.local/share/opencode/plugins/linear-workflow/{project-id}.sqlite`
- **Project ID**: Git 首个 root commit SHA（支持 worktree）
- **Issue ID 格式**: `^[A-Z][A-Z0-9]+-\d+$` (如 ENG-123)

## 🤝 贡献指南

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解贡献规范。

## 📄 许可证

MIT
