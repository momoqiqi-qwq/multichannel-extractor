import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const defaults = read('src/config/appearance.ts');
assert(defaults.includes('autoStartAfterImport: true'), '新安装/新通道默认自动开始未开启');
assert(defaults.includes('defaultPreferHighestVersion: true'), '关键词收件默认未优先最高版本');

const imports = read('src/stores/channelImportActions.ts');
assert(imports.includes('allowAutoStart?: boolean'), '导入流程缺少防重复自动开始选项');
assert(imports.includes('options.allowAutoStart !== false'), '导入流程未应用防重复自动开始选项');

const inbox = read('src/stores/channelInboxActions.ts');
for (const marker of [
  'forceImportSelected?: boolean',
  'suppressImportedAutoStart?: boolean',
  'deps.appSettings.value.keywordScanAutoAdd || options.forceImportSelected === true',
  'allowAutoStart: options.suppressImportedAutoStart !== true',
]) assert(inbox.includes(marker), `空队列扫描启动缺少：${marker}`);

const channels = read('src/stores/channels.ts');
const startActions = read('src/stores/channelStartActions.ts');
for (const marker of [
  'function canScanLatest(channel: Channel): boolean',
  'const hasAutoScannableChannels = computed(() => appSettings.value.scanLatestOnEmptyStart && hasScannableChannels.value)',
  'const hasStartableWork = computed(() => hasRunnableFiles.value || hasAutoScannableChannels.value)',
  'createChannelStartActions',
]) assert(channels.includes(marker), `开始流程缺少：${marker}`);
for (const marker of [
  "deps.scanChannelInbox(channel.id, true",
  'forceImportSelected: true',
  'suppressImportedAutoStart: true',
  "'扫描最新版后自动开始'",
  'scanLatestOnEmptyStart',
]) assert(startActions.includes(marker), `开始流程模块缺少：${marker}`);

const card = read('src/components/ChannelCard.vue');
assert(card.includes('扫描最新版并开始'), '空队列通道按钮未显示扫描最新版并开始');
assert(card.includes("isScanningInbox ? '扫描中…'"), '通道扫描中缺少防重复点击状态');

const app = read('src/App.vue');
assert(app.includes('store.hasStartableWork'), '顶部开始按钮未支持空队列扫描');
assert(app.includes("? '扫描并开始' : '全部开始'"), '顶部开始按钮缺少空队列提示');

const inboxUi = read('src/components/ChannelInboxSettings.vue');
assert(inboxUi.includes('selectedAlreadyAdded'), '扫描结果未按实际队列状态显示已选/推荐');

console.log('开始流程专项检查通过：默认自动开始、空队列扫描最新版、强制导入、防重复启动与按钮反馈均已覆盖。');
