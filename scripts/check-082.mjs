import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const version = read('src/config/version.ts');
assert(version.includes("APP_VERSION = '2.0.0'"), 'APP_VERSION 未更新到 2.0.0');

const packageJson = JSON.parse(read('package.json'));
const tauriConfig = JSON.parse(read('src-tauri/tauri.conf.json'));
assert(packageJson.version === '2.0.0', 'package.json 版本不是 2.0.0');
assert(tauriConfig.version === '2.0.0', 'Tauri 版本不是 2.0.0');
assert(read('src-tauri/Cargo.toml').includes('version = "2.0.0"'), 'Cargo 版本不是 2.0.0');

const types = read('src/types.ts');
for (const marker of ["ProjectStatus = 'active' | 'paused' | 'archived'", 'interface ProjectRecord', 'lastExtractedAt?: string']) {
  assert(types.includes(marker), `项目类型缺少：${marker}`);
}

const projectStore = read('src/stores/projectCenter.ts');
for (const marker of [
  'multichannel-extractor-projects-v1',
  'addOrUpdateProject',
  'togglePin',
  'clearArchived',
  'visibleProjects',
  'MAX_PROJECTS = 300',
]) assert(projectStore.includes(marker), `项目中心状态缺少：${marker}`);

const projectUi = read('src/components/ProjectCenterDrawer.vue');
for (const marker of [
  '项目中心',
  '添加项目',
  '用 DAT 打开 Claude',
  '复制路径',
  '已归档',
  '成功解压后的输出目录会自动收录',
]) assert(projectUi.includes(marker), `项目中心界面缺少：${marker}`);

const app = read('src/App.vue');
for (const marker of ['ProjectCenterDrawer', 'useProjectCenterStore', 'Ctrl+Shift+P', 'openProjectCenter']) {
  assert(app.includes(marker), `主界面缺少项目入口：${marker}`);
}

const channels = read('src/stores/channels.ts');
assert(channels.includes('projectCenter.addOrUpdateProject'), '成功解压结果未自动加入项目中心');
assert(channels.includes('已自动加入项目中心'), '自动收录缺少日志标记');

assert(read('src/style.css').includes("@import './styles/project-center.css'"), '项目中心样式未导入');

console.log('0.8.2 专项检查通过：版本、项目中心、自动收录、快捷入口与项目操作均有静态覆盖。');
