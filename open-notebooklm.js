const { chromium } = require('playwright');
const { loadConfig } = require('./config');

(async () => {
  const config = loadConfig();
  const context = await chromium.launchPersistentContext(config.userDataDir, {
    channel: 'msedge',
    headless: false,
    viewport: null,
    args: ['--start-maximized'],
  });

  const page = context.pages()[0] || await context.newPage();
  await page.goto(config.notebooklmUrl);
  console.log(`NotebookLM 已打开。配置文件：${config.configPath}`);
  console.log('请在 Edge 中登录 Google、打开目标 NotebookLM 笔记本并选择参考材料。完成后关闭窗口，或保持窗口用于人工检查。');
})();
