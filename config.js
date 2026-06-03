const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = __dirname;
const CONFIG_FILE = path.join(PROJECT_ROOT, 'config.json');
const EXAMPLE_CONFIG_FILE = path.join(PROJECT_ROOT, 'config.example.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveProjectPath(value, fallback) {
  const selected = value || fallback;
  if (path.isAbsolute(selected)) return selected;
  return path.resolve(PROJECT_ROOT, selected);
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function loadConfig() {
  const configPath = fs.existsSync(CONFIG_FILE) ? CONFIG_FILE : EXAMPLE_CONFIG_FILE;
  if (!fs.existsSync(configPath)) {
    throw new Error('找不到 config.json 或 config.example.json。请先复制 config.example.json 为 config.json 并填写配置。');
  }

  const raw = readJson(configPath);
  const config = {
    configPath,
    notebooklmUrl: raw.notebooklmUrl || 'https://notebooklm.google.com/',
    userDataDir: resolveProjectPath(raw.userDataDir, './edge-profile'),
    promptTemplate: raw.promptTemplate,
    words: raw.words,
    output: {
      json: resolveProjectPath(raw.output && raw.output.json, './notebooklm-results.json'),
      markdown: resolveProjectPath(raw.output && raw.output.markdown, './notebooklm-results.md'),
    },
    runtime: {
      answerTimeoutMs: positiveNumber(raw.runtime && raw.runtime.answerTimeoutMs, 300000),
      copyPollIntervalMs: positiveNumber(raw.runtime && raw.runtime.copyPollIntervalMs, 3000),
      copyStableRounds: positiveNumber(raw.runtime && raw.runtime.copyStableRounds, 3),
    },
    notion: raw.notion || {},
  };

  if (typeof config.promptTemplate !== 'string' || !config.promptTemplate.includes('{WORD}')) {
    throw new Error('promptTemplate 必须是字符串，并且必须包含 {WORD} 占位符。');
  }

  if (!Array.isArray(config.words) || config.words.length === 0 || config.words.some((word) => typeof word !== 'string' || !word.trim())) {
    throw new Error('words 必须是非空字符串数组。');
  }

  return config;
}

function buildPrompt(config, word) {
  return config.promptTemplate.split('{WORD}').join(word);
}

module.exports = { PROJECT_ROOT, loadConfig, buildPrompt };
