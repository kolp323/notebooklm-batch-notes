# NotebookLM Automation

Batch prompt NotebookLM with a reusable prompt template, Microsoft Edge, and Playwright. The script replaces `{WORD}` in your prompt template with each item in a word list, submits the prompts to NotebookLM, copies each generated answer, and exports JSON/Markdown results for later use in Notion or other note systems.

This project is designed for a human-in-the-loop NotebookLM workflow: you log in, choose the notebook, and select the reference materials; the script then automates repeated prompting and answer collection.

## Features

- Uses your installed Microsoft Edge via Playwright (`channel: "msedge"`).
- Uses a dedicated persistent Edge profile so NotebookLM login state can be reused.
- Reads prompt template, word list, output paths, and runtime settings from `config.json`.
- Supports `{WORD}` replacement anywhere in the prompt template.
- Saves resumable results to JSON and combined Markdown.
- Skips completed words on rerun.
- Supports force rerun.
- Keeps private login state and generated outputs out of git via `.gitignore`.

## Important limitations

- NotebookLM has no official public automation API for this workflow, so the script controls the web UI. If NotebookLM changes its UI, selectors may need updates.
- Google may block login in an automated browser. The recommended workaround is to log in manually inside the dedicated Edge profile using `npm run open`.
- The script does not directly write to Notion. It exports Markdown/JSON. A Claude/Notion MCP agent can read those files and append them to a Notion page.
- Do not commit `edge-profile/`, `config.json`, or generated results. They may contain login state, private material names, or private generated notes.

## Prerequisites

### 1. Microsoft Edge

Install Microsoft Edge and make sure it can open normally.

### 2. Node.js LTS

On Windows PowerShell, install Node.js LTS with winget:

```powershell
winget install OpenJS.NodeJS.LTS
```

Verify:

```powershell
node -v
npm -v
```

### 3. Project dependencies

From the project directory:

```powershell
npm install
```

You usually do **not** need to run `npx playwright install`, because the project uses your locally installed Edge instead of downloading Chromium.

## Quick start

### Step 1: Configure the project

Copy the example config:

```powershell
Copy-Item config.example.json config.json
```

Edit `config.json`.

Minimum fields to customize:

```json
{
  "notebooklmUrl": "https://notebooklm.google.com/",
  "userDataDir": "./edge-profile",
  "promptTemplate": "按照下面的提纲详细总结一下 第 8 章 PPT 中 {WORD} 的所有知识点或内容，并加上详细的讲解，输出为 markdown 笔记，不要包含引用标记：\n# {WORD}",
  "words": [
    "代码生成器设计中的问题",
    "目标语言"
  ],
  "output": {
    "json": "./notebooklm-results.json",
    "markdown": "./notebooklm-results.md"
  }
}
```

Rules:

- `promptTemplate` must contain `{WORD}`.
- `words` must be a non-empty string array.
- `userDataDir` should point to a dedicated browser profile, not your daily Edge profile.
- `notion.pageId` is optional and only used by a downstream Notion MCP/agent workflow.

### Step 2: Open NotebookLM and log in

Run:

```powershell
npm run open
```

In the opened Edge window:

1. Log in to Google if needed.
2. Open NotebookLM.
3. Open the target notebook.
4. Select/check the reference materials you want NotebookLM to use.
5. Make sure the chat input box is visible.

If Google blocks login in this automated window, close it and try again with the same command. The important part is that login state is stored in `./edge-profile`.

### Step 3: Start batch prompting

Close any other Edge window that is using the same `edge-profile`, then run:

```powershell
npm start
```

The script will reopen Edge and pause:

```text
请在打开的 Edge 中确认 NotebookLM 笔记本页面和参考材料已选好。
确认后回到此终端按 Enter 开始批量提问...
```

Confirm the NotebookLM page and selected sources in Edge, return to PowerShell, and press Enter.

### Step 4: Collect results

When finished, results are saved to:

```text
notebooklm-results.json
notebooklm-results.md
```

`notebooklm-results.json` contains structured records:

```json
{
  "word": "目标语言",
  "prompt": "...",
  "answer": "...",
  "createdAt": "2026-06-03T00:00:00.000Z"
}
```

`notebooklm-results.md` contains the combined Markdown notes separated by dividers.

## One-command workflow after setup

After Node dependencies, `config.json`, login, notebook selection, and reference material selection are ready, the normal run is:

```powershell
npm start
```

If previous results exist, completed words are skipped.

To rerun everything from scratch:

```powershell
npm run start:force
```

## Available npm scripts

```powershell
npm run open        # Open Edge with the dedicated profile for login/notebook setup
npm run login       # Alias of npm run open
npm start           # Run the batch prompt workflow
npm run batch       # Alias of npm start
npm run start:force # Rerun all words, ignoring existing result JSON
npm run check       # Syntax-check project scripts
```

## Configuration reference

### `notebooklmUrl`

NotebookLM entry URL or a specific notebook URL.

Default:

```json
"https://notebooklm.google.com/"
```

### `userDataDir`

Dedicated Edge profile directory.

Default:

```json
"./edge-profile"
```

Do not use your normal daily browser profile.

### `promptTemplate`

Prompt template. Every `{WORD}` substring is replaced with the current word.

Example:

```json
"按照下面的提纲详细总结一下 第 8 章 PPT 中 {WORD} 的所有知识点或内容，并加上详细的讲解，输出为 markdown 笔记，不要包含引用标记：\n# {WORD}"
```

### `words`

List of replacement terms. The script processes them in order.

```json
"words": [
  "代码生成器设计中的问题",
  "目标语言",
  "目标代码中的地址"
]
```

### `output`

Output file paths. Relative paths are resolved from the project root.

```json
"output": {
  "json": "./notebooklm-results.json",
  "markdown": "./notebooklm-results.md"
}
```

### `runtime`

Controls answer waiting and copy stabilization.

```json
"runtime": {
  "answerTimeoutMs": 300000,
  "copyPollIntervalMs": 3000,
  "copyStableRounds": 3
}
```

- Increase `answerTimeoutMs` if NotebookLM answers are long.
- Increase `copyStableRounds` if answers are sometimes copied before generation is complete.

### `notion`

Optional metadata for downstream Notion workflows. This script does not use it directly.

```json
"notion": {
  "pageTitle": "chap 8 代码生成和优化",
  "pageId": ""
}
```

## Writing results to Notion

This project exports Markdown. To write into Notion with Claude Code and Notion MCP:

1. Ask the agent to read `.claude/workflow.md`.
2. Provide or confirm the Notion page URL/page ID.
3. Ask the agent to read `notebooklm-results.md`.
4. The agent should clean unwanted conversational text if needed.
5. The agent should call Notion MCP `update-page` / `insert_content` to append Markdown to the target page.

Example downstream instruction:

```text
Read .claude/workflow.md, then append notebooklm-results.md to the Notion page configured in config.json.
```

## Troubleshooting

### Google says the browser cannot log in

Use the dedicated profile setup path:

```powershell
npm run open
```

Log in manually in the opened Edge window. Do not try to automate the login itself.

### Browser/profile is already in use

Close all Edge windows opened by this project and run again. A Playwright persistent profile cannot be used by two running browser contexts at the same time.

### Script cannot find NotebookLM input box

Make sure the current page is an opened NotebookLM notebook chat page and the input box is visible. If NotebookLM changed its UI, update the locators in `batch-notebooklm.js`.

### Answers are incomplete

Increase these values in `config.json`:

```json
"runtime": {
  "answerTimeoutMs": 600000,
  "copyPollIntervalMs": 5000,
  "copyStableRounds": 4
}
```

### Rerun only failed/missing topics

Keep `notebooklm-results.json`; the script skips completed `word` entries. Remove specific entries from the JSON if you want to rerun only those topics.

## Security and privacy

- `edge-profile/` contains browser state and possibly authentication cookies.
- `config.json` may contain private page IDs or task details.
- `notebooklm-results.*` may contain private generated notes.
- These files are ignored by `.gitignore` and should not be published.

## Development

Syntax-check scripts:

```powershell
npm run check
```

The current implementation is intentionally small and dependency-light. Prefer surgical selector/config changes over broad abstractions.

## License

MIT
