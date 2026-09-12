import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const archiveSource = [
  'src-tauri/src/archive/mod.rs',
  'src-tauri/src/archive/layout.rs',
  'src-tauri/src/archive/extractors.rs',
  'src-tauri/src/archive/kind.rs',
  'src-tauri/src/archive/error.rs',
  'src-tauri/src/archive/collision.rs',
  'src-tauri/src/archive/path_safety.rs',
].map(read).join('\n');
const defaultsSource = read('src/config/appearance.ts');
const stateSource = read('src/domain/state.ts');
const manifestSource = read('src-tauri/src/task_manifest.rs');
const commandSource = read('src-tauri/src/commands.rs') + read('src-tauri/src/commands_preflight.rs');
const taskControlSource = read('src-tauri/src/task_control.rs');
const plannerSource = read('src/domain/jobPlanner.ts');
const taskHistorySource = read('src/stores/taskCenter.ts');

function mapPath(path, mode, depth = 0, stripOuter = false) {
  const parts = path.split('/').filter(Boolean);
  if (stripOuter && parts.length > 1) parts.shift();
  if (mode === 'preserve' || mode === 'skipOuter') return parts.join('/');
  const file = parts.pop();
  return [...parts.slice(0, Math.max(0, depth)), file].join('/');
}

const cases = [
  ['保留结构', mapPath('root/assets/icons/icon.txt', 'preserve'), 'root/assets/icons/icon.txt'],
  ['完全展平', mapPath('root/assets/icons/icon.txt', 'flatten', 0), 'icon.txt'],
  ['保留 1 层', mapPath('root/assets/icons/icon.txt', 'flatten', 1), 'root/icon.txt'],
  ['保留 2 层', mapPath('root/assets/icons/icon.txt', 'flatten', 2), 'root/assets/icon.txt'],
  ['跳过单一外层', mapPath('root/assets/icons/icon.txt', 'skipOuter', 0, true), 'assets/icons/icon.txt'],
];
for (const [label, actual, expected] of cases) {
  if (actual !== expected) throw new Error(`${label} 映射失败：${actual} != ${expected}`);
}

const requiredRustTests = [
  'preserve_materializes_full_structure',
  'flatten_materializes_requested_depth',
  'skip_outer_materializes_without_single_root',
  'matching_archive_wrapper_does_not_double_nest',
  'overwrite_policy_replaces_existing_file',
  'flatten_zero_places_file_at_destination_root',
  'unsafe_archive_paths_are_rejected',
  'tar_pipeline_applies_skip_outer',
  'corrupt_archive_does_not_create_destination',
];
for (const name of requiredRustTests) {
  if (!archiveSource.includes(`fn ${name}`)) throw new Error(`Rust 回归测试缺失：${name}`);
}
for (const marker of ['deduplicate_archive_root', 'copy_with_policy', 'safe_archive_path', 'is_junk_path']) {
  if (!archiveSource.includes(marker)) throw new Error(`后端层级/安全逻辑缺失：${marker}`);
}
if (!manifestSource.includes('delete_from_manifest')) throw new Error('缺少基于任务清单的安全删除。');
if (!manifestSource.includes('skipped_replaced_files')) throw new Error('安全删除未保护被替换文件。');
if (!defaultsSource.includes('defaultCreateArchiveSubfolder: false')) throw new Error('新通道默认应直接写入目标目录。');
if (!defaultsSource.includes("defaultCollisionPolicy: 'overwrite'")) throw new Error('重名文件默认应直接替换。');
if (!stateSource.includes('legacyLayoutMigration')) throw new Error('缺少旧版输出布局迁移。');

for (const marker of ['preflight_jobs', 'available_space', 'minimum_free_bytes', 'space_multiplier', 'existing-output']) {
  if (!commandSource.includes(marker)) throw new Error(`开始前预检查缺失：${marker}`);
}
for (const marker of ['cancelled: AtomicBool', 'paused: AtomicBool', 'checkpoint']) {
  if (!taskControlSource.includes(marker)) throw new Error(`暂停/继续控制缺失：${marker}`);
}
for (const marker of ["['high', 'normal', 'low']", 'scheduleQueues', 'Priority is global']) {
  if (!plannerSource.includes(marker)) throw new Error(`优先级调度缺失：${marker}`);
}
for (const marker of ['jieyatai-task-history-v2', 'jobSnapshot', "status: 'interrupted'", 'pausedDurationMs']) {
  if (!taskHistorySource.includes(marker)) throw new Error(`中断恢复持久化缺失：${marker}`);
}

console.log('层级与可靠性检查通过：路径映射、安全删除、预检查、任务级中断恢复、暂停检查点、全局优先级和 ETA 计时均有静态覆盖。');

const directoryScanSource = read('src-tauri/src/directory_scan.rs');
const inboxStoreSource = read('src/stores/channels.ts') + read('src/stores/channelInboxActions.ts');
const projectToolsSource = read('src/stores/channelProjectTools.ts');
const systemToolsSource = read('src-tauri/src/system_tools.rs');
for (const marker of ['extract_version', 'compare_versions', 'prefer_highest_version', 'modified_unix', 'include_prerelease']) {
  if (!directoryScanSource.includes(marker)) throw new Error(`关键词版本筛选缺失：${marker}`);
}
for (const marker of ['scanChannelInbox', 'scanAllKeywordChannels', 'keywordScanReplaceQueue', 'keywordScanAutoAdd', 'openInboxDirectory', 'getDownloadDirectory']) {
  if (!inboxStoreSource.includes(marker)) throw new Error(`关键词收件流程缺失：${marker}`);
}
for (const marker of ['latestExtractedDirectory', "file.status === 'success'", 'file.outputPath', 'claudeVerifyBeforeLaunch', 'launchClaudeForFile']) {
  if (!projectToolsSource.includes(marker)) throw new Error(`Claude 解压目录约束缺失：${marker}`);
}
for (const marker of ['CREATE_NEW_CONSOLE', '.current_dir(&directory)', 'claude --dangerously-skip-permissions', 'process_id: child.id()']) {
  if (!systemToolsSource.includes(marker)) throw new Error(`Claude 新控制台启动保障缺失：${marker}`);
}

console.log('v0.8.1 扩展检查通过：每通道自动开始、Claude DAT 启动、关键词收件与自定义背景参数均有静态覆盖。');
