import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const packageJson = JSON.parse(read('package.json'));
const tauri = JSON.parse(read('src-tauri/tauri.conf.json'));
const version = read('src/config/version.ts');

assert(packageJson.name === 'jieyatai-2', 'package 名称不是 jieyatai-2');
assert(packageJson.version === '2.0.0' && tauri.version === '2.0.0', '技术版本不是 2.0.0');
assert(version.includes("APP_RELEASE_NAME = 'jieyatai-2'"), '发布名不是 jieyatai-2');
assert(version.includes('CONFIG_SCHEMA_VERSION = 10'), '配置架构不是 v10');
assert(read('src-tauri/Cargo.toml').includes('version = "2.0.0"'), 'Cargo 版本不是 2.0.0');

const state = read('src/domain/state.ts');
assert(state.includes("multichannel-extractor-state-v10"), '工作区存储未升级到 v10');
assert(state.includes("multichannel-extractor-state-v9"), '未保留 jieyatai-1 工作区兼容迁移');
assert(state.includes("multichannel-extractor-presets-v10"), '预设存储未升级到 v10');
assert(state.includes("multichannel-extractor-presets-v9"), '未保留 jieyatai-1 预设兼容迁移');

const app = read('src/App.vue');
for (const marker of ['CommandPalette', 'RecentActionsDrawer', "event.key.toLowerCase() === 'k'", "event.key.toLowerCase() === 'z'", 'showCommandPaletteShortcut', 'showRecentActionsShortcut', 'showUndoShortcut']) {
  assert(app.includes(marker), `全局工作流缺少：${marker}`);
}
for (const marker of ['ExtractionHistoryDrawer', 'openExtractionHistory', 'historyDrawerOpen', '解压历史', 'showExtractionHistoryShortcut']) {
  assert(app.includes(marker), `解压历史入口缺少：${marker}`);
}

const extractionHistory = read('src/components/ExtractionHistoryDrawer.vue');
for (const marker of ['recentExtractions', 'extractionHistoryLimit', '打开目录', '重新运行']) {
  assert(extractionHistory.includes(marker), `解压历史抽屉缺少：${marker}`);
}
const reliabilitySettings = read('src/components/settings/ReliabilitySettings.vue');
for (const marker of ['解压历史显示条数', '任务历史保留数量', 'TASK_HISTORY_RETENTION_OPTIONS', 'EXTRACTION_HISTORY_LIMIT_OPTIONS', '打开解压历史']) {
  assert(reliabilitySettings.includes(marker), `可靠性设置缺少：${marker}`);
}

const palette = read('src/components/CommandPalette.vue');
for (const marker of ['SETTINGS_SEARCH_INDEX', '撤销上一步', '聚焦工作区搜索', '打开总设置', 'jieyatai:open-setting']) {
  assert(palette.includes(marker), `命令面板缺少：${marker}`);
}

const history = read('src/stores/workspaceHistory.ts') + read('src/stores/channelWorkspaceActions.ts');
for (const marker of ['undoStack', 'recentActions', 'cloneChannels', 'presets', 'undoLastAction']) {
  assert(history.includes(marker), `最近操作/撤销缺少：${marker}`);
}

const automation = read('src/components/ChannelAutomationSettings.vue') + read('src/stores/channelWorkspaceActions.ts');
for (const marker of ['纯手动', '导入即开始', '最新版按需', '最新版自动', 'applyChannelAutomationProfile']) {
  assert(automation.includes(marker), `通道自动化方案缺少：${marker}`);
}

const configuration = read('src/stores/channelConfiguration.ts');
for (const marker of ['renamePreset', 'duplicatePreset', 'movePreset', '重命名预设', '复制预设', '调整预设顺序']) {
  assert(configuration.includes(marker), `预设管理缺少：${marker}`);
}
const maintenance = read('src/components/settings/MaintenanceSettings.vue');
for (const marker of ['重命名', '复制', 'store.movePreset', 'store.deletePreset']) {
  assert(maintenance.includes(marker), `预设管理界面缺少：${marker}`);
}

const types = read('src/types.ts');
const appearance = read('src/config/appearance.ts') + read('src/components/settings/AppearanceSettings.vue');
for (const marker of ['workspaceWidth', 'showBrandSubtitle', 'showColumnHeaders', 'showToolbarSummary', 'showStatusBar', 'showChannelAutomationControls']) {
  assert(types.includes(marker) && appearance.includes(marker), `布局自定义缺少：${marker}`);
}

const search = read('src/config/settingsSearch.ts');
for (const marker of ['全局命令开关', '最近操作开关', '撤销开关', '工作区宽度', '预设重命名', '预设复制', '预设排序']) {
  assert(search.includes(marker), `设置搜索未覆盖：${marker}`);
}
const searchIndexBlock = search.split('export const SETTINGS_SEARCH_INDEX: SettingSearchItem[] = [')[1]?.split('];')[0] ?? '';
const searchCount = (searchIndexBlock.match(/\{ id: '/g) || []).length;
assert(searchCount >= 88, `设置搜索索引数量不足：${searchCount}`);

const channelLines = read('src/stores/channels.ts').split(/\r?\n/).length;
assert(channelLines <= 1250, `channels.ts 超过 1250 行：${channelLines}`);
assert(read('src/stores/channelWorkspaceActions.ts').split(/\r?\n/).length <= 120, 'channelWorkspaceActions.ts 过大');

console.log(`jieyatai-2 专项检查通过：命令面板、最近操作/撤销、通道自动化、预设重命名/复制/排序、布局自定义与 v9→v10 兼容迁移均已覆盖；设置索引 ${searchCount} 项。`);
