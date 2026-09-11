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
const defaults = read('src/config/appearance.ts');
const app = read('src/App.vue');
const appearance = read('src/components/settings/AppearanceSettings.vue');
const drawer = read('src/components/SettingsDrawer.vue');
const sidebar = read('src/components/settings/SettingsSidebar.vue');
const searchConfig = read('src/config/settingsSearch.ts');
const searchUi = drawer + sidebar + searchConfig;
const css = read('src/styles/settings.css');

const visibilitySettings = [
  'showTopbarConcurrency',
  'showQuickSettings',
  'showProjectCenterShortcut',
  'showTaskCenterShortcut',
  'showLogsShortcut',
  'showWorkspaceSearch',
  'showWorkspaceFilters',
  'showShortcutHints',
];
for (const setting of visibilitySettings) {
  assert(types.includes(`${setting}: boolean`), `AppSettings 缺少 ${setting}`);
  assert(defaults.includes(`${setting}: true`), `默认设置缺少 ${setting}`);
  assert(app.includes(`appSettings.${setting}`), `主界面没有使用 ${setting}`);
  assert(appearance.includes(`appSettings.${setting}`), `外观设置页没有 ${setting} 开关`);
}

for (const marker of [
  'SETTINGS_SEARCH_INDEX',
  'aliases:',
  "aliases: ['zdbfs', 'bfs', 'bf', 'concurrency']",
  "aliases: ['gjlxd', 'gjlxdd', 'sticky']",
  'jumpToSetting',
  'scrollIntoView',
  'settings-search-target',
  'settings-search-results',
  '回车直达首项',
]) assert(searchUi.includes(marker) || css.includes(marker), `设置搜索缺少：${marker}`);


const tabFiles = {
  general: 'src/components/settings/GeneralSettings.vue',
  appearance: 'src/components/settings/AppearanceSettings.vue',
  behavior: 'src/components/settings/BehaviorSettings.vue',
  output: 'src/components/settings/OutputSettings.vue',
  destinations: 'src/components/settings/ChannelDestinationsSettings.vue',
  inbox: 'src/components/settings/InboxSettings.vue',
  reliability: 'src/components/settings/ReliabilitySettings.vue',
  recovery: 'src/components/settings/RecoverySettings.vue',
  developer: 'src/components/settings/DeveloperToolsSettings.vue',
  maintenance: 'src/components/settings/MaintenanceSettings.vue',
  about: 'src/components/settings/AboutSettings.vue',
};
const indexedRows = searchConfig.split(/\r?\n/).filter((line) => line.includes('{ id:') && line.includes(' tab:'));
assert(indexedRows.length >= 60, `设置搜索索引过少：${indexedRows.length}`);
for (const line of indexedRows) {
  const tab = line.match(/tab: '([^']+)'/)?.[1];
  const label = line.match(/label: '([^']+)'/)?.[1];
  const targetText = line.match(/targetText: '([^']+)'/)?.[1] ?? label;
  assert(tab && label && targetText, `无法解析搜索索引：${line}`);
  const file = tabFiles[tab];
  assert(file, `搜索索引使用未知分类：${tab}`);
  assert(read(file).includes(targetText), `搜索目标不存在：${label} -> ${targetText}`);
}

assert(css.includes('settings-search-pulse'), '搜索定位缺少高亮动画');
assert(css.includes('.settings-drawer-v7.compact .settings-search input'), '紧凑侧栏未保留搜索输入框');
assert(packageJson.scripts['check:085'] === 'node scripts/check-085.mjs', 'package.json 未注册 0.8.5 专项检查');

console.log('0.8.5 专项检查通过：版本、8 个工作区显示开关、缩写搜索、一键定位、高亮与紧凑侧栏搜索均有静态覆盖。');
