# NotebookLM Automation

用 Playwright 打开本机 Microsoft Edge，批量向 NotebookLM 提问，并把回答保存为本地 JSON / Markdown。

脚本只做一件事：

> 把 `promptTemplate` 里的 `{WORD}` 依次替换为 `words` 中的每个主题，提交给 NotebookLM，复制回答，写入结果文件。

Notion 写入不由本脚本完成；需要写入 Notion 时，由 **Claude Code** 读取结果文件并通过 Notion MCP 写入目标页面。

## 环境要求

- Microsoft Edge
- Node.js LTS / npm
- 可访问 NotebookLM 的 Google 账号

## 安装

在项目目录运行：

```powershell
npm install
Copy-Item config.example.json config.json
```

## 配置

编辑 `config.json`。最小需要关注这些字段：

```json
{
  "notebooklmUrl": "https://notebooklm.google.com/",
  "userDataDir": "./edge-profile",
  "promptTemplate": "请根据资料总结 {WORD}，输出 markdown：\n# {WORD}",
  "words": [
    "主题一",
    "主题二"
  ],
  "output": {
    "json": "./notebooklm-results.json",
    "markdown": "./notebooklm-results.md"
  },
  "runtime": {
    "answerTimeoutMs": 300000,
    "copyPollIntervalMs": 3000,
    "copyStableRounds": 3
  },
  "notion": {
    "pageTitle": "",
    "pageId": ""
  }
}
```

规则：

- `promptTemplate` 必须包含 `{WORD}`。
- `words` 必须是非空字符串数组。
- `userDataDir` 必须使用专用浏览器目录，不要指向日常 Edge profile。
- `notion` 只给 Claude Code 定位页面用；脚本本身不会写 Notion。

## 使用

运行：

```powershell
npm start
```

脚本会打开 Edge，并在终端暂停。你需要在 Edge 中手动完成：

1. 登录 Google。
2. 打开目标 NotebookLM 笔记本。
3. 选择本轮要使用的参考材料。
4. 确认聊天输入框可见。

然后回到终端按 Enter，脚本开始批量提问。

结果会保存到：

```text
notebooklm-results.json
notebooklm-results.md
```

再次运行 `npm start` 时，脚本会根据 JSON 结果跳过已完成的 `word`。

如果要忽略旧结果并全部重跑：

```powershell
npm run start:force
```

## npm scripts

```powershell
npm start           # 批量提问并保存结果
npm run start:force # 忽略已有 JSON，全部重跑
npm run check       # 检查脚本语法
```

## 写入 Notion

本项目的 Node 脚本 **不会** 调用 Notion API，也不会直接修改 Notion 页面。

写入 Notion 的操作由 **Claude Code** 完成：Claude Code 读取 `notebooklm-results.md` 或 `notebooklm-results.json`，在你确认目标页面后，通过 Notion MCP 把 Markdown 追加或写入 Notion。

推荐指令示例：

```text
请读取 config.json 和 notebooklm-results.md，把结果写入 config.json 中 notion.pageId 对应的 Notion 页面。
```

如果 `notion.pageId` 为空，请直接把 Notion 页面 URL 或页面 ID 发给 Claude Code。Claude Code 会在写入前确认目标页面；Notion 页面的追加、替换、创建等操作都由 Claude Code 执行，不由 `npm start` 执行。

## 常见问题

### 浏览器 profile 被占用

关闭本项目打开的 Edge 窗口后重试。同一个 `userDataDir` 不能被两个 Playwright 进程同时使用。

### 找不到 NotebookLM 输入框

确认当前 Edge 页面已经进入目标 NotebookLM 笔记本，并且聊天输入框可见。如果 NotebookLM 改版，可能需要更新 `batch-notebooklm.js` 中的定位器。

### 回答复制不完整

增大 `config.json` 中的等待参数：

```json
{
  "runtime": {
    "answerTimeoutMs": 600000,
    "copyPollIntervalMs": 5000,
    "copyStableRounds": 4
  }
}
```

## 隐私

不要提交这些文件或目录：

- `edge-profile/`：浏览器登录状态。
- `config.json`：可能包含私人任务和 Notion 页面信息。
- `notebooklm-results*.json` / `notebooklm-results*.md`：NotebookLM 输出内容。

这些路径已在 `.gitignore` 中忽略。

## License

MIT
