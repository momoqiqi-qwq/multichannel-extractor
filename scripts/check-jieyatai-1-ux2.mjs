import { readFileSync, existsSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const types = read('src/types.ts');
const defaults = read('src/config/appearance.ts');
const app = read('src/App.vue');
const card = read('src/components/ChannelCard.vue');
const appearance = read('src/components/settings/AppearanceSettings.vue');
const behavior = read('src/components/settings/BehaviorSettings.vue');
const config = read('src/stores/channelConfiguration.ts');
const channels = read('src/stores/channels.ts');
const start = read('src/stores/channelStartActions.ts');
const search = read('src/config/settingsSearch.ts');

assert(existsSync(new URL('../src/stores/channelStartActions.ts', import.meta.url)), '缺少独立开始流程模块');
assert(channels.includes("createChannelStartActions"), 'channels store 未接入独立开始流程模块');
assert(defaults.includes('scanLatestOnEmptyStart: true'), '空队列扫描最新版默认未开启');
assert(types.includes('scanLatestOnEmptyStart: boolean'), 'AppSettings 缺少空队列扫描开关');
assert(behavior.includes('空队列开始时扫描最新版') && behavior.includes('scanLatestOnEmptyStart'), '操作与导航页缺少空队列扫描开关');
for (const marker of ['scanLatestAndStartChannel', 'forceImportSelected: true', 'suppressImportedAutoStart: true', "'扫描最新版后自动开始'"]) {
  assert(start.includes(marker), `开始流程缺少：${marker}`);
}
assert(start.includes('deps.appSettings.value.scanLatestOnEmptyStart'), '开始流程未读取空队列扫描开关');
assert(app.includes('hasAutoScannableChannels'), '顶部开始按钮未区分自动扫描可用状态');
assert(card.includes('canAutoScanLatest') && card.includes('扫描最新版并开始'), '通道按钮未实现空队列扫描后自动开始');

assert(appearance.includes('<h3>工作区开关</h3>'), '界面设置未统一使用“开关”命名');
const visibility = [
  'showExpandCollapseControl', 'showGlobalStartControl', 'showInboxScanControl', 'showWorkspaceCleanupControls',
  'showAddChannelControl', 'showChannelOrderControls', 'showChannelDuplicateControl', 'showChannelDeleteControl',
];
for (const setting of visibility) {
  assert(types.includes(`${setting}: boolean`), `AppSettings 缺少 ${setting}`);
  assert(defaults.includes(`${setting}: true`), `默认设置缺少 ${setting}`);
  assert(appearance.includes(`appSettings.${setting}`), `界面开关页未接入 ${setting}`);
}
for (const setting of ['showExpandCollapseControl', 'showGlobalStartControl', 'showInboxScanControl', 'showWorkspaceCleanupControls', 'showAddChannelControl']) {
  assert(app.includes(`appSettings.${setting}`), `主界面未使用 ${setting}`);
}
for (const setting of ['showChannelOrderControls', 'showChannelDuplicateControl', 'showChannelDeleteControl']) {
  assert(card.includes(`appSettings.${setting}`), `通道卡片未使用 ${setting}`);
}

assert(card.includes('selectedPresetName') && card.includes('删除已选预设'), '通道卡片缺少预设删除入口');
assert(config.includes('确定删除已保存的通道预设') && config.includes("title: '预设已删除'"), '预设删除缺少确认或反馈');
assert(search.includes("['开关', 'kg']"), '设置搜索缺少 kg=开关缩写');
assert(search.includes("label: '空队列开始时扫描最新版'") && search.includes("label: '通道删除开关'"), '新增设置未进入设置搜索索引');

console.log('jieyatai-1 UX2 专项检查通过：开关命名、更多界面开关、空队列扫描最新版自动开始、通道预设删除和开始流程拆分均已覆盖。');
