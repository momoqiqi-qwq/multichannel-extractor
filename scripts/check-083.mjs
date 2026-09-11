import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const packageJson = JSON.parse(read('package.json'));
const tauriConfig = JSON.parse(read('src-tauri/tauri.conf.json'));
assert(packageJson.version === '2.0.0', 'package.json 版本不是 2.0.0');
assert(tauriConfig.version === '2.0.0', 'Tauri 版本不是 2.0.0');
assert(read('src/config/version.ts').includes("APP_VERSION = '2.0.0'"), '应用内版本不是 2.0.0');
assert(read('src-tauri/Cargo.toml').includes('version = "2.0.0"'), 'Cargo 版本不是 2.0.0');

const projectTools = read('src/stores/channelProjectTools.ts');
for (const marker of [
  'configuredClaudeDirectory',
  'if (!channel.useArchiveDirectory) return normalizePathInput(channel.destination)',
  '项目工具不会再额外弹出目录选择器',
  'return configuredDirectory',
]) assert(projectTools.includes(marker), `通道项目目录规则缺少：${marker}`);

const resolveStart = projectTools.indexOf('async function resolveClaudeDirectoryForChannel');
const resolveEnd = projectTools.indexOf('async function generateClaudeDatAt', resolveStart);
const resolveBlock = projectTools.slice(resolveStart, resolveEnd);
assert(!resolveBlock.includes('chooseClaudeDirectory'), '通道项目目录解析仍会打开目录选择器');

const channelCard = read('src/components/ChannelCard.vue') + read('src/components/ChannelProjectTools.vue');
for (const marker of [
  '直接使用当前通道的解压目录',
  '这里不会再弹出额外的目录选择器',
  '请先配置通道解压目录',
]) assert(channelCard.includes(marker), `通道项目工具提示缺少：${marker}`);

const models = read('src-tauri/src/models.rs');
assert(models.includes('pub source: Option<String>'), 'Claude CLI 状态缺少来源字段');
const types = read('src/types.ts');
assert(types.includes('source?: string'), '前端 Claude CLI 状态缺少来源字段');

const rust = read('src-tauri/src/claude_cli.rs');
for (const marker of [
  'npm_global_locations',
  'npm_output(&["prefix", "-g"])',
  'npm_output(&["root", "-g"])',
  '@anthropic-ai/claude-code',
  'claude-code-win32-x64',
  'claude-code-win32-arm64',
  'package_bin_resolution',
  'resolve_claude_cli',
  'npm install -g @anthropic-ai/claude-code',
]) assert(rust.includes(marker), `npm Claude CLI 检测缺少：${marker}`);

const settings = read('src/components/settings/DeveloperToolsSettings.vue');
for (const marker of [
  '来源：{{ cliStatus.source }}',
  '先查系统 PATH，再查 npm 全局目录',
  'npm install -g @anthropic-ai/claude-code',
]) assert(settings.includes(marker), `项目工具设置提示缺少：${marker}`);

console.log('0.8.5 专项检查通过：通道解压目录直用、无额外目录弹窗、npm 官方 Claude CLI 探测与来源展示均有静态覆盖。');
