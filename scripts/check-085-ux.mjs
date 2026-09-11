import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const searchConfig = read('src/config/settingsSearch.ts');
const sidebar = read('src/components/settings/SettingsSidebar.vue');
const drawer = read('src/components/SettingsDrawer.vue');
const app = read('src/App.vue');
const settingsCss = read('src/styles/settings.css');
const workspaceCss = read('src/styles/workspace.css');
const packageJson = JSON.parse(read('package.json'));

assert(searchConfig.includes("['启动', 'qd']"), '缺少“启动 -> qd”通用缩写映射');
for (const id of ['scan-on-launch', 'auto-resume', 'claude-launch', 'claude-auto-install', 'claude-verify', 'claude-safe-confirm']) {
  const row = searchConfig.split(/\r?\n/).find((line) => line.includes(`id: '${id}'`));
  assert(row, `搜索索引缺少 ${id}`);
  assert(row.includes("'qd'"), `${id} 未声明 qd 启动缩写`);
}

const qdStartupRows = searchConfig.split(/\r?\n/).filter((line) => line.includes("aliases: ['qd'") && line.includes('启动'));
assert(qdStartupRows.length >= 5, `qd 启动结果覆盖不足：${qdStartupRows.length}`);

for (const marker of [
  "event.key === 'ArrowDown'",
  "event.key === 'ArrowUp'",
  "event.key === 'Enter'",
  "event.key === 'Escape'",
  'activeResultIndex',
  'defineExpose({ focusSearch })',
  '找到 ${results.length} 项',
  'qd</code> 启动',
]) assert(sidebar.includes(marker), `设置搜索键盘体验缺少：${marker}`);

for (const marker of ['watch(() => store.settingsOpen', 'settingsSidebar.value?.focusSearch()', "event.key.toLowerCase() === 'f'"]) {
  assert(drawer.includes(marker), `设置抽屉搜索聚焦缺少：${marker}`);
}

for (const marker of ["event.key === '/'", 'workspaceSearchInput.value?.focus()', 'hasActiveWorkspaceFilter', 'clearWorkspaceFilters', '清除筛选']) {
  assert(app.includes(marker), `工作区体验优化缺少：${marker}`);
}

assert(settingsCss.includes('.settings-search-result.active'), '搜索结果缺少键盘选中样式');
assert(settingsCss.includes('.settings-search-status'), '搜索结果缺少状态提示样式');
assert(workspaceCss.includes('.workspace-filter-reset'), '工作区缺少筛选重置样式');
assert(packageJson.scripts['check:085ux'] === 'node scripts/check-085-ux.mjs', 'package.json 未注册 UX 专项检查');

console.log('0.8.5 UX 专项检查通过：qd 启动搜索、键盘选择/直达、自动聚焦、Ctrl+F 设置搜索、/ 工作区搜索和一键清筛选均已覆盖。');
