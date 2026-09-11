import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const version = read('src/config/version.ts');
assert(version.includes("APP_VERSION = '2.0.0'"), 'APP_VERSION 未更新到 2.0.0');
assert(version.includes('CONFIG_SCHEMA_VERSION = 10'), '配置架构未更新到 v10');

const types = read('src/types.ts');
assert((types.match(/autoStartEnabled: boolean/g) || []).length >= 2, '通道与预设缺少 autoStartEnabled');
assert(types.includes('datPath: string'), 'Claude 启动结果缺少 datPath');

const state = read('src/domain/state.ts');
for (const marker of [
  "multichannel-extractor-state-v9",
  "multichannel-extractor-presets-v9",
  'autoStartEnabled: raw.autoStartEnabled ?? settings.autoStartAfterImport',
  'autoStartEnabled: settings.autoStartAfterImport',
  'autoStartEnabled: channel.autoStartEnabled',
  'overwriteClaudeBat',
  'claudeAutoInstallBat',
]) assert(state.includes(marker), `状态迁移缺少：${marker}`);

const channels = read('src/stores/channels.ts') + read('src/stores/channelImportActions.ts');
for (const marker of [
  'const autoStartFileIds: string[] = []',
  'if (channel.autoStartEnabled && supportedAdded > 0 && options.allowAutoStart !== false)',
  'files: importedFiles',
  "['pending'], true",
  "automaticContext = '自动开始'",
]) assert(channels.includes(marker), `通道自动开始缺少：${marker}`);
assert(!channels.includes('if (appSettings.value.autoStartAfterImport && supportedAdded > 0)'), '仍在使用全局开关直接控制已有通道');

const channelCard = read('src/components/ChannelCard.vue') + read('src/components/ChannelProjectTools.vue');
for (const marker of [
  'v-model="channel.autoStartEnabled"',
  '生成 Claude DAT',
  '用 DAT 打开 Claude',
  'generateClaudeDatForChannel',
  "run('generate')",
  '这里不会再弹出额外的目录选择器',
]) assert(channelCard.includes(marker), `通道界面缺少：${marker}`);
assert(!channelCard.includes(':disabled="!claudeDirectory"'), 'Claude 通道按钮仍会因缺少历史解压目录而永久禁用');

const general = read('src/components/settings/GeneralSettings.vue');
assert(general.includes('APP_RELEASE_NAME') && general.includes('APP_VERSION'), '常用设置页未同时显示发布版本与技术版本');
assert(general.includes('v{{ CONFIG_SCHEMA_VERSION }}'), '常用设置页未显示配置架构');

const projectTools = read('src/stores/channelProjectTools.ts');
for (const marker of ['installClaudeDat', 'launchClaudeFromDat', 'result.datPath', 'resolveClaudeDirectoryForChannel', 'configuredClaudeDirectory']) {
  assert(projectTools.includes(marker), `Claude DAT 前端缺少：${marker}`);
}

const developerTools = read('src/components/settings/DeveloperToolsSettings.vue');
assert(developerTools.includes("runAction('generate')"), '项目工具页缺少自动选目录的生成入口');
assert(!developerTools.includes(':disabled="!ready" @click="store.generateClaudeDatAt'), '项目工具页生成按钮仍因空路径禁用');

const rust = read('src-tauri/src/system_tools.rs');
for (const marker of [
  'const CLAUDE_DAT_NAME: &str = "我的Claude项目.dat"',
  'resolve_claude_dat',
  'JIEYATAI_CLAUDE_DAT',
  'CLAUDE_COMMAND: &str = "claude --dangerously-skip-permissions"',
]) assert(rust.includes(marker), `Claude DAT 后端缺少：${marker}`);
assert(!rust.includes('include_bytes!("../resources/claude-bypass'), '后端仍依赖旧 BAT 资源');

console.log('0.8.1 回归专项检查通过：每通道自动开始、Claude DAT、版本显示与 v8 迁移均已覆盖。');
