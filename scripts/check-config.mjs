import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const full = (path) => resolve(root, path);
const read = (path) => readFileSync(full(path), 'utf8');
const fail = (message) => {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
};
const lines = (path) => read(path).split(/\r?\n/).length;

function walk(directory, extension) {
  const results = [];
  for (const entry of readdirSync(full(directory), { withFileTypes: true })) {
    const child = `${directory}/${entry.name}`;
    if (entry.isDirectory()) results.push(...walk(child, extension));
    else if (!extension || entry.name.endsWith(extension)) results.push(child);
  }
  return results;
}

function requireMarkers(source, markers, label) {
  for (const marker of markers) {
    if (!source.includes(marker)) fail(`${label}缺少功能标记：${marker}`);
  }
}

const packageJson = JSON.parse(read('package.json'));
const tauriConfig = JSON.parse(read('src-tauri/tauri.conf.json'));
const cargoToml = read('src-tauri/Cargo.toml');
const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
if (packageJson.version !== tauriConfig.version || packageJson.version !== cargoVersion) {
  fail(`版本号不一致：package=${packageJson.version}, tauri=${tauriConfig.version}, cargo=${cargoVersion}`);
}
if (packageJson.version !== '2.0.0') fail(`jieyatai-2 技术版本应为 2.0.0，实际为 ${packageJson.version}`);
requireMarkers(read('src/config/version.ts'), ["APP_VERSION = '2.0.0'", "APP_RELEASE_NAME = 'jieyatai-2'", 'CONFIG_SCHEMA_VERSION = 10'], '版本配置');
if (tauriConfig.app?.windows?.[0]?.skipTaskbar !== false) fail('主窗口必须保留任务栏图标。');
if (tauriConfig.mainBinaryName !== 'JieYaTai') fail('mainBinaryName 应为 JieYaTai。');
if (!tauriConfig.bundle?.windows?.nsis?.installerIcon) fail('NSIS installerIcon 未配置。');
if (tauriConfig.app?.security?.assetProtocol?.enable !== true) fail('自定义背景需要启用 assetProtocol。');
if (!tauriConfig.app?.security?.assetProtocol?.scope?.includes('$APPDATA/**/*')) fail('背景资源协议必须限制在应用数据目录。');

const capabilities = JSON.parse(read('src-tauri/capabilities/default.json'));
if (!capabilities.permissions?.includes('dialog:allow-open')) fail('目录/文件选择器缺少 dialog:allow-open 权限。');
if (!capabilities.permissions?.includes('opener:allow-open-path')) fail('打开输出目录缺少 opener:allow-open-path 权限。');

const requiredFiles = [
  'src/components/TaskCenterDrawer.vue',
  'src/components/ProjectCenterDrawer.vue',
  'src/components/StartReviewDialog.vue',
  'src/components/ChannelFileQueue.vue',
  'src/components/ChannelOutputSettings.vue',
  'src/components/ChannelDepthSettings.vue',
  'src/components/ChannelInboxSettings.vue',
  'src/components/settings/GeneralSettings.vue',
  'src/components/settings/AppearanceSettings.vue',
  'src/components/settings/BehaviorSettings.vue',
  'src/components/settings/OutputSettings.vue',
  'src/components/settings/InboxSettings.vue',
  'src/components/settings/ReliabilitySettings.vue',
  'src/components/settings/RecoverySettings.vue',
  'src/components/settings/DeveloperToolsSettings.vue',
  'src/components/settings/MaintenanceSettings.vue',
  'src/components/settings/AboutSettings.vue',
  'src/stores/taskCenter.ts',
  'src/stores/projectCenter.ts',
  'src/stores/settings.ts',
  'src/stores/notifications.ts',
  'src/services/appearance.ts',
  'src/stores/channelSelectors.ts',
  'src/stores/channelOutputActions.ts',
  'src/stores/channelProjectTools.ts',
  'src/stores/channelInboxActions.ts',
  'src/stores/channelConfiguration.ts',
  'src/stores/channelWorkspaceActions.ts',
  'src/stores/workspaceHistory.ts',
  'src/components/CommandPalette.vue',
  'src/components/RecentActionsDrawer.vue',
  'src/components/ChannelAutomationSettings.vue',
  'src-tauri/src/archive/mod.rs',
  'src-tauri/src/archive/layout.rs',
  'src-tauri/src/archive/extractors.rs',
  'src-tauri/src/archive/kind.rs',
  'src-tauri/src/archive/error.rs',
  'src-tauri/src/archive/collision.rs',
  'src-tauri/src/archive/path_safety.rs',
  'src-tauri/src/task_control.rs',
  'src-tauri/src/directory_scan.rs',
  'src-tauri/src/task_manifest.rs',
  'src-tauri/src/system_tools.rs',
  'src-tauri/src/claude_cli.rs',
  'docs/CODE_REVIEW.md',
  'docs/RELEASE_NOTES_0.8.5.md',
  'docs/IMPLEMENTATION_CHECKLIST_0.8.5.md',
  'docs/TEST_REPORT_0.8.5.md',
  'docs/VALIDATION_0.8.5.txt',
  'docs/NEXT_VERSION_0.9.0.md',
  'docs/optimized-ui-preview.html',
  'src-tauri/icons/icon.ico',
  'src-tauri/icons/icon.icns',
  'src-tauri/icons/icon.png',
  'public/app-icon.svg',
];
for (const file of requiredFiles) if (!existsSync(full(file))) fail(`缺少文件：${file}`);

const appearance = read('src/config/appearance.ts');
const themeIds = [...appearance.matchAll(/\{ id: '([^']+)', name:/g)].map((match) => match[1]);
const categoryStart = appearance.indexOf('export const CHANNEL_CATEGORIES');
const themesOnly = themeIds.filter((id) => appearance.indexOf(`{ id: '${id}'`) < categoryStart);
if (themesOnly.length !== 11) fail(`主题数量应为 11，实际为 ${themesOnly.length}。`);
requireMarkers(appearance, [
  'backgroundFocusX: 50',
  'backgroundFocusY: 50',
  'preflightEnabled: true',
  'preflightSpaceMultiplier: 3',
  'showOutputPreviewBeforeStart: true',
  'enablePauseResume: true',
  'showEta: true',
  'enableFilePriority: true',
  'defaultPreferHighestVersion: true',
  'keywordScanMaxCandidates: 30',
  'keywordScanAutoAdd: true',
  'claudeVerifyBeforeLaunch: true',
  'backgroundVignette: 0.18',
], '默认设置');

for (const file of walk('src', '.vue')) {
  const content = read(file);
  if ((content.match(/<script setup lang="ts">/g) || []).length !== 1) fail(`${file} 缺少唯一 script setup。`);
  const templateStart = content.indexOf('<template>');
  const templateEnd = content.lastIndexOf('</template>');
  if (templateStart < 0 || templateEnd <= templateStart) fail(`${file} 缺少有效的顶层 template 区块。`);
}

const channelUi = [
  'src/components/ChannelCard.vue',
  'src/components/ChannelProjectTools.vue',
  'src/components/ChannelFileQueue.vue',
  'src/components/ChannelOutputSettings.vue',
  'src/components/ChannelDepthSettings.vue',
  'src/components/ChannelInboxSettings.vue',
].map(read).join('\n');
requireMarkers(channelUi, [
  'output-mode-switch',
  'store.browseDestination',
  'collisionPolicy',
  'aria-pressed',
  'skipJunkFiles',
  'keepEmptyDirectories',
  'output-container-switch',
  'layout-example',
  'deduplicateArchiveRoot',
  'store.rerunChannel',
  'store.deleteChannelOutputs',
  'store.generateClaudeDatForChannel',
  'store.launchClaudeForChannel',
  'store.launchClaudeForFile',
  'store.pauseChannel',
  'store.resumeChannel',
  'file.priority',
  'store.scanChannelInbox',
  'channel.inboxKeywords',
  'channel.autoStartEnabled',
], '通道界面');
if (/path-input[^>]*:disabled/.test(channelUi)) fail('路径输入框不应被“跟随压缩包”模式禁用。');

const frontend = walk('src', '.ts').map(read).join('\n') + walk('src', '.vue').map(read).join('\n');
requireMarkers(frontend, [
  'deleteExtraction',
  'installClaudeDat',
  'launchClaudeFromDat',
  'TaskCenterDrawer',
  'ExtractionHistoryDrawer',
  'recentExtractions',
  'finishedRecords',
  'extractionHistoryLimit',
  'EXTRACTION_HISTORY_LIMIT_OPTIONS',
  'TASK_HISTORY_RETENTION_OPTIONS',
  'showExtractionHistoryShortcut',
  'StartReviewDialog',
  'taskHistoryRetention',
  'confirmBeforeDeleteOutput',
  'pickBackgroundImage',
  'backgroundImagePath',
  'backgroundImageEnabled',
  'channelTransparencyEnabled',
  'channelPanelOpacity',
  'backgroundFocusX',
  'backgroundFocusY',
  'preflightJobs',
  'preflightSpaceMultiplier',
  'resumeInterruptedTasks',
  'jobSnapshot',
  'requiresPassword',
  'pauseFile',
  'resumeFile',
  'enableFilePriority',
  'etaSeconds',
  'exportTemplates',
  'importTemplates',
  'APP_VERSION',
  'settingsSidebarCompact',
  'scanArchiveDirectory',
  'getDownloadDirectory',
  'checkClaudeCli',
  'claudeVerifyBeforeLaunch',
  'claudeAutoInstallDat',
  '@anthropic-ai/claude-code',
  'keywordScanAutoAdd',
  'backgroundScale',
  'backgroundVignette',
], '前端');

const startReview = read('src/components/StartReviewDialog.vue');
requireMarkers(startReview, ['review-output-branches', 'pathSegments', 'estimatedRequiredBytes', 'blockingCount'], '开始前预览');
const settingsDrawer = read('src/components/SettingsDrawer.vue');
const settingsSidebar = read('src/components/settings/SettingsSidebar.vue');
const settingsSearch = read('src/config/settingsSearch.ts');
requireMarkers(settingsDrawer + settingsSidebar + settingsSearch, ['version-chip', 'APP_RELEASE_NAME', 'settings-search', "id: 'inbox'", "id: 'recovery'", "id: 'about'"], '总设置');
const taskCenter = read('src/stores/taskCenter.ts');
requireMarkers(taskCenter, ['jieyatai-task-history-v2', "status: 'interrupted'", 'pausedDurationMs', 'markRecovered'], '任务恢复');
const planner = read('src/domain/jobPlanner.ts');
requireMarkers(planner, ["['high', 'normal', 'low']", 'Priority is global'], '文件优先级调度');

const rust = walk('src-tauri/src', '.rs').map(read).join('\n');
requireMarkers(rust, [
  'delete_extraction',
  'install_claude_dat',
  'launch_claude_dat',
  'write_manifest',
  'ExtractionReport',
  'replaced_files',
  'install_background_image',
  'pause_job',
  'resume_job',
  'preflight_jobs',
  'TaskControl',
  'checkpoint',
  'available_space',
  'space_multiplier',
  'acquire_with_control',
  'scan_archive_directory',
  'get_download_directory',
  'check_claude_cli',
  'CREATE_NEW_CONSOLE',
  'process_id',
  'CLAUDE_DAT_NAME',
  'npm_global_locations',
  '@anthropic-ai/claude-code',
], 'Rust 后端');
if (!cargoToml.includes('fs2 = "0.4"')) fail('磁盘空间预检查依赖 fs2 未配置。');
const lib = read('src-tauri/src/lib.rs');
for (const command of [
  'delete_extraction',
  'install_claude_dat',
  'launch_claude_dat',
  'install_background_image',
  'clear_background_image',
  'pause_job',
  'resume_job',
  'preflight_jobs',
  'scan_archive_directory',
  'get_download_directory',
  'check_claude_cli',
]) {
  if (!lib.includes(command)) fail(`Tauri 命令未注册：${command}`);
}

const extractorSource = read('src-tauri/src/archive/extractors.rs');
for (const functionName of ['extract_zip', 'extract_tar', 'extract_single_stream', 'extract_7z', 'extract_rar']) {
  if (!extractorSource.includes(`pub(super) fn ${functionName}`)) fail(`归档提取器对子模块不可见：${functionName}`);
}
const kindSource = read('src-tauri/src/archive/kind.rs');
if (!kindSource.includes('#[derive(Debug, Clone, Copy)]')) fail('ArchiveKind 必须可复制，避免格式标签消费枚举值。');
const errorSource = read('src-tauri/src/archive/error.rs');
if (!errorSource.includes('#[derive(Debug, Error)]')) fail('ArchiveError 必须同时实现 Debug 与 Error。');
const commandSource = read('src-tauri/src/commands.rs');
if (/emit_finished\(\s*&app,\s*&job,\s*&job,/m.test(commandSource)) fail('emit_finished 参数中出现重复 job 引用。');
if (!commandSource.includes('Weak<Semaphore>')) fail('目标目录锁缓存应使用 Weak<Semaphore>，避免历史目录永久占用内存。');
const mainSource = read('src-tauri/src/main.rs');
if (!mainSource.includes('windows_subsystem = "windows"')) fail('Windows 发布构建未关闭额外控制台窗口。');

const systemTools = read('src-tauri/src/system_tools.rs');
requireMarkers(systemTools, [
  'const CLAUDE_DAT_NAME: &str = "我的Claude项目.dat"',
  'install_claude_dat',
  'resolve_claude_dat',
  'launch_claude_dat',
  'JIEYATAI_CLAUDE_DAT',
  'crate::claude_cli::resolve_claude_cli',
], 'Claude DAT');
const claudeCli = read('src-tauri/src/claude_cli.rs');
requireMarkers(claudeCli, [
  'resolve_claude_cli',
  'npm_global_locations',
  '@anthropic-ai/claude-code',
  'package_bin_resolution',
], 'Claude CLI 探测');
if (!systemTools.includes('CLAUDE_COMMAND: &str = "claude --dangerously-skip-permissions"')) fail('Claude 命令必须固定在后端。');
if (/C:\\Users\\[^\r\n]+\\claude\.(cmd|exe)/i.test(systemTools + claudeCli)) fail('Claude DAT 启动器不得包含开发机绝对路径。');

const baseStyles = read('src/styles/base.css');
const settingsStyles = read('src/styles/settings.css');
const layoutStyles = read('src/styles/layout.css');
if (!baseStyles.includes('z-index: 220')) fail('抽屉遮罩层级应高于吸顶工具栏。');
requireMarkers(settingsStyles, ["data-channel-transparency='on'", '.settings-sidebar-v7', '.background-focus-preview', '.start-review-dialog'], '设置样式');
if (!layoutStyles.includes('grid-template-columns: minmax(330px, 1.2fr)')) fail('通道设置三列响应式布局缺失。');

for (const file of walk('src/styles', '.css')) {
  let depth = 0;
  for (const character of read(file)) {
    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
    if (depth < 0) break;
  }
  if (depth !== 0) fail(`${file} 花括号不平衡，最终深度 ${depth}。`);
}
if (lines('src/style.css') > 20) fail('src/style.css 应仅作为拆分样式入口。');
if (lines('src/components/SettingsDrawer.vue') > 120) fail('SettingsDrawer.vue 仍然过大。');
if (lines('src/components/ChannelCard.vue') > 380) fail('ChannelCard.vue 仍然过大。');
if (lines('src/stores/channels.ts') > 1250) fail('channels.ts 仍然超过 1250 行。');
if (lines('src-tauri/src/commands.rs') > 650) fail('commands.rs 仍然超过 650 行。');
if (lines('src-tauri/src/claude_cli.rs') > 400) fail('claude_cli.rs 仍然超过 400 行。');
for (const file of walk('src-tauri/src/archive', '.rs')) {
  if (lines(file) > 600) fail(`${file} 仍然超过 600 行。`);
}

const ico = readFileSync(full('src-tauri/icons/icon.ico'));
if (ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1) fail('Windows ICO 文件头无效。');
if (ico.readUInt16LE(4) < 7) fail(`Windows ICO 至少应含 7 个尺寸，实际 ${ico.readUInt16LE(4)}。`);

if (!process.exitCode) {
  console.log(`静态配置检查通过：版本 ${packageJson.version}，任务恢复、开始前自检、输出预览、暂停继续、优先级、ETA、模板与可拖动背景焦点均已覆盖。`);
}
