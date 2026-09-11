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

const types = read('src/types.ts');
assert((types.match(/autoLaunchClaudeAfterExtract: boolean/g) || []).length >= 2, '通道与预设缺少 Claude 自动启动字段');

const state = read('src/domain/state.ts');
for (const marker of [
  'autoLaunchClaudeAfterExtract: raw.autoLaunchClaudeAfterExtract ?? false',
  'autoLaunchClaudeAfterExtract: false',
  'autoLaunchClaudeAfterExtract: channel.autoLaunchClaudeAfterExtract',
]) assert(state.includes(marker), `Claude 自动启动持久化缺少：${marker}`);

const channelCard = read('src/components/ChannelProjectTools.vue');
for (const marker of [
  '解压完成后自动运行 Claude',
  'changeAutoLaunch',
  'channel.autoLaunchClaudeAfterExtract',
  'claude --dangerously-skip-permissions',
  '同一输出目录 8 秒内只启动一次',
]) assert(channelCard.includes(marker), `通道项目工具开关缺少：${marker}`);

const projectTools = read('src/stores/channelProjectTools.ts');
for (const marker of [
  'launchClaudeAfterExtraction',
  'skipConfirmation: true',
  'automatic: true',
  'AUTOMATIC_LAUNCH_DEDUPLICATION_MS = 8000',
  '同一目录刚刚已自动启动 Claude',
]) assert(projectTools.includes(marker), `自动启动实现缺少：${marker}`);

const channels = read('src/stores/channels.ts');
for (const marker of [
  'found.channel.autoLaunchClaudeAfterExtract',
  'launchClaudeAfterExtraction(event.outputPath, found.channel.name, found.file.name)',
  'autoLaunchClaudeAfterExtract: source.autoLaunchClaudeAfterExtract',
]) assert(channels.includes(marker), `任务完成联动缺少：${marker}`);

const configuration = read('src/stores/channelConfiguration.ts');
assert((configuration.match(/autoLaunchClaudeAfterExtract:/g) || []).length >= 2, '预设保存与应用未覆盖自动启动开关');

const developerSettings = read('src/components/settings/DeveloperToolsSettings.vue');
assert(developerSettings.includes('自动运行使用任务的实际输出目录'), '项目工具设置页缺少自动启动说明');

console.log('0.8.5 专项检查通过：解压完成自动启动 Claude、危险操作确认、持久化、预设与同目录防重复均有静态覆盖。');
