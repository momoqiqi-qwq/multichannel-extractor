import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const packageJson = JSON.parse(read('package.json'));
const tauriConfig = JSON.parse(read('src-tauri/tauri.conf.json'));
const version = read('src/config/version.ts');
const types = read('src/types.ts');
const defaults = read('src/config/appearance.ts');
const app = read('src/App.vue');
const general = read('src/components/settings/GeneralSettings.vue');
const drawer = read('src/components/SettingsDrawer.vue');
const destinations = read('src/components/settings/ChannelDestinationsSettings.vue');
const search = read('src/config/settingsSearch.ts');
const index = read('index.html');
const vite = read('vite.config.ts');

assert(packageJson.name === 'jieyatai-1', 'package 名称未更新为 jieyatai-1');
assert(packageJson.version === '1.0.0', 'package 技术版本不是 1.0.0');
assert(tauriConfig.version === '1.0.0', 'Tauri 技术版本不是 1.0.0');
assert(version.includes("APP_RELEASE_NAME = 'jieyatai-1'"), '应用发布版本名不是 jieyatai-1');
assert(version.includes("APP_VERSION = '1.0.0'"), '应用技术版本不是 1.0.0');
assert(read('src-tauri/Cargo.toml').includes('version = "1.0.0"'), 'Cargo 技术版本不是 1.0.0');

assert(types.includes('showDetailedExplanations: boolean'), 'AppSettings 缺少详细解释开关');
assert(defaults.includes('showDetailedExplanations: false'), '详细解释默认值未配置');
assert(general.includes('显示详细解释') && general.includes('showDetailedExplanations'), '总设置常规页缺少详细解释开关');
assert(app.includes('data-detailed-explanations'), '应用根节点未绑定详细解释显示状态');

assert(search.includes("id: 'destinations'") && search.includes('通道解压地址'), '设置导航未添加通道解压地址页面');
assert(drawer.includes('ChannelDestinationsSettings'), 'SettingsDrawer 未挂载通道解压地址页面');
for (const marker of ['store.channels', '跟随压缩包', '指定目录', 'store.browseDestination', 'store.commitDestination', '使用默认地址', '最近地址', '使用首个文件目录']) {
  assert(destinations.includes(marker), `通道解压地址页面缺少：${marker}`);
}
assert(search.includes("aliases: ['tdjydz', 'jydz', 'tdml', 'dz', 'path']"), '通道解压地址未加入设置搜索缩写');

assert(index.includes('不能直接双击 index.html') && index.includes('start-web-preview.cmd'), 'index.html 未解释源码包直接打开失败原因');
assert(packageJson.scripts['preview:browser'] === 'vite --host 127.0.0.1 --open', '浏览器预览脚本未配置');
assert(fs.existsSync('start-web-preview.cmd'), '缺少 Windows 一键网页预览入口');
assert(fs.existsSync('start-tauri-dev.cmd'), '缺少 Windows 一键桌面开发入口');
assert(vite.includes("base: './'"), 'Vite 未使用相对资源基路径');

console.log('jieyatai-1 专项检查通过：发布命名、页面访问提示、详细解释开关、通道解压地址中心与搜索入口均已覆盖。');
