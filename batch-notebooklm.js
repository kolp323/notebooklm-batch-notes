const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { loadConfig, buildPrompt } = require('./config');

function waitForEnter(message) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(message, () => {
    rl.close();
    resolve();
  }));
}

async function firstVisible(locators) {
  for (const locator of locators) {
    const count = await locator.count().catch(() => 0);
    for (let i = count - 1; i >= 0; i -= 1) {
      const item = locator.nth(i);
      if (await item.isVisible().catch(() => false)) return item;
    }
  }
  throw new Error('找不到 NotebookLM 输入框，请确认页面已打开到笔记本聊天界面。');
}

async function fillPrompt(page, prompt) {
  const input = await firstVisible([
    page.getByRole('textbox'),
    page.locator('textarea'),
    page.locator('[contenteditable="true"]'),
  ]);

  await input.click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.press('Backspace');
  await input.fill(prompt).catch(async () => {
    await page.keyboard.insertText(prompt);
  });
}

async function clickSend(page) {
  const send = await firstVisible([
    page.getByRole('button', { name: /send|submit|ask|发送|提交|提问/i }),
    page.locator('button[aria-label*="Send"], button[aria-label*="send"], button[aria-label*="发送"], button[aria-label*="提交"]'),
  ]);
  await send.click();
}

async function copyButtonCount(page) {
  return page.getByRole('button', { name: /copy|复制/i }).count().catch(() => 0);
}

async function readClipboard(page) {
  return page.evaluate(async () => navigator.clipboard.readText()).catch(() => '');
}

function cleanAnswer(text) {
  return text
    .replace(/【\d+†[^】]+】/g, '')
    .replace(/\s*\[(?:\d+|\d+\s*[-–]\s*\d+)(?:\s*,\s*\d+)*\]/g, '')
    .trim();
}

async function waitAndCopyLatestAnswer(page, previousCopyCount, runtime) {
  const copyButtons = page.getByRole('button', { name: /copy|复制/i });
  await page.waitForFunction(
    ({ previousCopyCount }) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.filter((button) => /copy|复制/i.test(button.getAttribute('aria-label') || button.textContent || '')).length > previousCopyCount;
    },
    { previousCopyCount },
    { timeout: runtime.answerTimeoutMs }
  );

  let last = '';
  let stableRounds = 0;
  const attempts = Math.ceil(runtime.answerTimeoutMs / runtime.copyPollIntervalMs);
  for (let i = 0; i < attempts; i += 1) {
    const count = await copyButtons.count();
    await copyButtons.nth(count - 1).click();
    const current = cleanAnswer(await readClipboard(page));

    if (current && current === last) {
      stableRounds += 1;
      if (stableRounds >= runtime.copyStableRounds) return current;
    } else {
      stableRounds = 0;
      last = current;
    }

    await page.waitForTimeout(runtime.copyPollIntervalMs);
  }

  if (last) return last;
  throw new Error('回答生成后未能从复制按钮读取到内容。');
}

function sectionMarkdown(result) {
  const trimmed = result.answer.trim();
  const firstLine = trimmed.split('\n').map((line) => line.trim()).find(Boolean) || '';
  if (/^#\s+/.test(firstLine)) return trimmed;
  return `# ${result.word}\n\n${trimmed}`;
}

function saveResults(config, results) {
  fs.mkdirSync(path.dirname(config.output.json), { recursive: true });
  fs.mkdirSync(path.dirname(config.output.markdown), { recursive: true });
  fs.writeFileSync(config.output.json, JSON.stringify(results, null, 2), 'utf8');
  const markdown = results.map(sectionMarkdown).join('\n\n---\n\n');
  fs.writeFileSync(config.output.markdown, markdown, 'utf8');
}

function loadExistingResults(config, force) {
  if (force || !fs.existsSync(config.output.json)) return [];
  return JSON.parse(fs.readFileSync(config.output.json, 'utf8'));
}

(async () => {
  const config = loadConfig();
  const force = process.argv.includes('--force');
  const notebookOrigin = new URL(config.notebooklmUrl).origin;
  const notebookHost = new URL(config.notebooklmUrl).host;

  const context = await chromium.launchPersistentContext(config.userDataDir, {
    channel: 'msedge',
    headless: false,
    viewport: null,
    args: ['--start-maximized'],
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: notebookOrigin });

  let page = context.pages().find((candidate) => candidate.url().includes(notebookHost));
  page = page || context.pages()[0] || await context.newPage();
  if (!page.url().includes(notebookHost)) {
    await page.goto(config.notebooklmUrl);
  }

  console.log(`配置文件：${config.configPath}`);
  console.log('请在打开的 Edge 中登录 Google，进入目标 NotebookLM 笔记本，并选择本轮要使用的参考材料。');
  await waitForEnter('确认聊天输入框可见后，回到此终端按 Enter 开始批量提问...');

  const results = loadExistingResults(config, force);
  const completed = new Set(results.map((item) => item.word));

  for (const word of config.words) {
    if (completed.has(word)) {
      console.log(`跳过已完成：${word}`);
      continue;
    }

    console.log(`开始：${word}`);
    const prompt = buildPrompt(config, word);
    const previousCopyCount = await copyButtonCount(page);
    await fillPrompt(page, prompt);
    await clickSend(page);
    const answer = await waitAndCopyLatestAnswer(page, previousCopyCount, config.runtime);

    results.push({ word, prompt, answer, createdAt: new Date().toISOString() });
    saveResults(config, results);
    console.log(`完成：${word}`);
  }

  saveResults(config, results);
  console.log(`全部完成。结果已保存：\n${config.output.json}\n${config.output.markdown}`);
})();
