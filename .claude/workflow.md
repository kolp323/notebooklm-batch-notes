# NotebookLM 批量提示词自动化工作流

本文档给 Claude Code / agent 快速接手用。项目根目录为当前仓库根目录；具体本地路径由用户所在环境决定。

## 目标

把提示词模板中的 `{WORD}` 占位符替换为词语列表中的每个词，逐条提交给 NotebookLM，让 NotebookLM 基于用户已选择的笔记本和参考材料生成 Markdown 笔记。脚本把回答保存到本地 JSON 和 Markdown 文件。

需要写入 Notion 时，由 Claude Code 读取本地结果文件，再用 Notion MCP 写入用户指定页面。Node 脚本本身不调用 Notion。

## 当前项目结构

- `config.example.json`：开源配置模板。
- `config.json`：用户本地配置，包含 NotebookLM 地址、Edge profile、提示词模板、词语列表、输出路径、Notion 页面提示信息；不应提交。
- `config.js`：读取和校验配置。
- `batch-notebooklm.js`：打开 Edge，批量提交提示词，复制 NotebookLM 回答，保存输出。
- `notebooklm-results.json`：每个词对应的原始 prompt、answer、createdAt；不应提交。
- `notebooklm-results.md`：合并后的 Markdown 笔记，用于写入 Notion；不应提交。
- `edge-profile/`：Edge 专用自动化用户数据目录，包含登录态；不应提交。
- `.gitignore`：忽略登录态、依赖、本地配置和输出结果。

## 环境要求

- Windows / PowerShell。
- 已安装 Microsoft Edge。
- 已安装 Node.js LTS 和 npm。
- 已安装项目依赖：`npm install`。
- 项目使用 Playwright 的 `chromium.launchPersistentContext(..., { channel: 'msedge' })`，直接调用本机 Edge，不需要 `npx playwright install`。

## 首次环境配置

1. 在项目目录运行：

```powershell
npm install
Copy-Item config.example.json config.json
```

2. 编辑 `config.json`：

- `notebooklmUrl`：NotebookLM 入口或具体笔记本 URL。默认 `https://notebooklm.google.com/`。
- `userDataDir`：Edge 自动化 profile 路径。默认 `./edge-profile`。
- `promptTemplate`：提示词模板，必须包含 `{WORD}`。
- `words`：词语列表，数组形式，一项一个主题。
- `output.json`：结果 JSON 路径。
- `output.markdown`：结果 Markdown 路径。
- `runtime.answerTimeoutMs`：等待新回答出现的最长时间。
- `runtime.copyPollIntervalMs`：轮询复制按钮内容的间隔。
- `runtime.copyStableRounds`：连续复制到相同内容多少次后认为回答稳定完成。
- `notion.pageTitle` / `notion.pageId`：给 Claude Code 用于定位 Notion 页面；脚本本身不写 Notion。

## 批量提问流程

1. 确认 `config.json` 已配置。
2. 运行：

```powershell
npm start
```

3. 脚本会打开 Edge，并在终端提示：

```text
请在打开的 Edge 中登录 Google，进入目标 NotebookLM 笔记本，并选择本轮要使用的参考材料。
确认聊天输入框可见后，回到此终端按 Enter 开始批量提问...
```

4. 用户在 Edge 中完成：

- 登录 Google。
- 进入目标 NotebookLM 笔记本。
- 勾选本轮提问需要使用的参考材料。
- 确认聊天输入框可见。

5. 回到终端按 Enter。
6. 脚本逐条处理 `config.words`：

- 用 `promptTemplate` 替换所有 `{WORD}`。
- 定位 NotebookLM 输入框并填入提示词。
- 点击发送按钮。
- 等待新的复制按钮出现。
- 持续点击最新回答的复制按钮，直到剪贴板内容连续稳定若干轮。
- 清理常见引用标记。
- 追加保存到 `notebooklm-results.json` 和 `notebooklm-results.md`。

7. 脚本可断点续跑：如果 `output.json` 已存在，已完成的 `word` 会跳过。
8. 如需强制重跑所有主题：

```powershell
npm run start:force
```

## Notion 写入流程

Notion 操作明确由 Claude Code 完成，不由本项目的 Node 脚本完成。

推荐流程：

1. Claude Code 读取 `config.json`，确认 `notion.pageId` 或 `notion.pageTitle`。
2. Claude Code 读取 `notebooklm-results.md` 或 `notebooklm-results.json`。
3. 如果用户只给了页面标题，Claude Code 用 Notion MCP 搜索页面。
4. 写入前建议清理 NotebookLM 输出中的：

- 外层 ```markdown 代码围栏。
- “这是为你整理……”这类对话式开头（按用户要求决定是否保留）。
- “接下来要不要继续……”这类对话式结尾。
- 引用标记。

5. Claude Code 用 Notion MCP `notion-update-page` 的 `insert_content` 将 Markdown 追加到页面末尾，或按用户要求执行替换/创建。
6. 写入、追加、替换、创建 Notion 页面的实际操作都由 Claude Code 发起并完成；`npm start` 只生成本地结果文件。

## 常见故障和处理

### Google 无法登录

不要自动化 Google 登录。运行 `npm start` 后，在打开的 Edge 窗口中手动登录。登录态会保存在 `edge-profile/`。

### profile 被占用

如果报 profile/浏览器上下文占用，关闭所有由本项目打开的 Edge 窗口，再运行脚本。同一个 `userDataDir` 不能被多个 Playwright persistent context 同时使用。

### 找不到输入框或发送按钮

让用户确认当前页面确实是 NotebookLM 笔记本聊天界面，且参考材料选择完成、聊天输入框可见。NotebookLM UI 变更时可能需要更新 `batch-notebooklm.js` 中的定位器。

### 回答没复制完整

增加 `config.json` 中：

- `runtime.answerTimeoutMs`
- `runtime.copyPollIntervalMs`
- `runtime.copyStableRounds`

或者人工检查 `notebooklm-results.md` 后再写入 Notion。

## 给接手 agent 的注意事项

- 不要提交或公开 `edge-profile/`、`config.json`、`notebooklm-results.*`，里面可能包含登录态、用户笔记内容和私有输出。
- 开源仓库应保留 `config.example.json`，不要保留用户私有配置和输出。
- 若要写 Notion，先明确用户授权的目标页面；写入前可搜索标题或使用 `config.json` 中的 pageId。
- 对 NotebookLM 内容只能在用户已选择/授权的笔记本和参考材料范围内自动化。
- 若用户要求更换章节或任务，只需修改 `promptTemplate`、`words` 和 `notion` 配置。
