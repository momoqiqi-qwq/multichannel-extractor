import { computed, onScopeDispose, ref, watch } from 'vue';
import { defineStore, storeToRefs } from 'pinia';
import { categoryDefinition } from '../config/appearance';
import { applyAppearanceSettings } from '../services/appearance';
import { writeJson } from '../services/persistence';
import {
  cancelJob,
  pauseJob,
  resumeJob,
  preflightJobs,
  inspectFiles,
  pickDirectory,
  startBatch,
} from '../services/tauri';
import { normalizePathInput, parentDirectory } from '../utils/path';
import { buildJobs } from '../domain/jobPlanner';
import { useTaskCenterStore } from './taskCenter';
import { useProjectCenterStore } from './projectCenter';
import { useSettingsStore } from './settings';
import { useNotificationStore } from './notifications';
import { useWorkspaceHistoryStore } from './workspaceHistory';
import { findArchiveFile, getChannelProgress, getChannelStatus, getVisibleFiles } from './channelSelectors';
import { createChannelProjectTools } from './channelProjectTools';
import { createChannelInboxActions } from './channelInboxActions';
import { createChannelImportActions } from './channelImportActions';
import { createChannelRoutingActions } from './channelRoutingActions';
import { createChannelConfigurationActions } from './channelConfiguration';
import { createChannelStartActions } from './channelStartActions';
import { createChannelOutputActions } from './channelOutputActions';
import { createChannelWorkspaceActions } from './channelWorkspaceActions';
import {
  STORAGE_KEY,
  createId,
  defaultChannel,
  loadPersisted,
  normalizeChannel,
  toPersistedChannel,
  type PersistedState,
} from '../domain/state';
import type {
  ArchiveFile,
  BatchFinishedEvent,
  Channel,
  ChannelCategory,
  FileSortMode,
  FileStatus,
  DepthModeType,
  JobFinishedEvent,
  ProgressEvent,
  StartReviewState,
  PreflightResult,
  PreflightIssue,
  TaskRecord,
  ExtractionJobPayload,
} from '../types';

export const useChannelStore = defineStore('channels', () => {
  const taskCenter = useTaskCenterStore(); const projectCenter = useProjectCenterStore();
  const settingsStore = useSettingsStore();
  const notifications = useNotificationStore();
  const history = useWorkspaceHistoryStore();
  const { appSettings, maxConcurrency, recentDestinations, presets, settingsOpen } = storeToRefs(settingsStore);
  const { logs, toasts, logDrawerOpen } = storeToRefs(notifications);
  const { addLog, pushToast, dismissToast, exportLogs } = notifications;
  const persisted = loadPersisted();
  const channels = ref<Channel[]>(
    persisted?.channels?.length
      ? persisted.channels.map((channel, index) => normalizeChannel(channel, index + 1, appSettings.value))
      : [defaultChannel(1, appSettings.value, 'work'), defaultChannel(2, appSettings.value, 'download')],
  );
  const activeBatchIds = ref<string[]>([]);
  const startReview = ref<StartReviewState | null>(null);
  let startReviewResolver: ((accepted: boolean) => void) | null = null;

  const totalFiles = computed(() => channels.value.reduce((sum, channel) => sum + channel.files.length, 0));
  const processingFiles = computed(() =>
    channels.value.reduce(
      (sum, channel) => sum + channel.files.filter((file) => ['processing', 'queued', 'paused'].includes(file.status)).length,
      0,
    ),
  );
  const failedFiles = computed(() =>
    channels.value.reduce((sum, channel) => sum + channel.files.filter((file) => file.status === 'error').length, 0),
  );
  const completedFiles = computed(() =>
    channels.value.reduce((sum, channel) => sum + channel.files.filter((file) => file.status === 'success').length, 0),
  );
  const hasRunnableFiles = computed(() =>
    channels.value.some((channel) =>
      channel.files.some((file) => file.supported && ['pending', 'error', 'cancelled'].includes(file.status)),
    ),
  );

  function canScanLatest(channel: Channel): boolean {
    return Boolean(
      channel.inboxEnabled
      && channel.inboxDirectory.trim()
      && channel.inboxKeywords.trim()
      && !channel.files.some((file) => ['queued', 'processing', 'paused'].includes(file.status)),
    );
  }

  const hasScannableChannels = computed(() => channels.value.some((channel) => canScanLatest(channel)));
  const hasAutoScannableChannels = computed(() => appSettings.value.scanLatestOnEmptyStart && hasScannableChannels.value);
  const hasStartableWork = computed(() => hasRunnableFiles.value || hasAutoScannableChannels.value);
  const persistedChannels = computed(() => channels.value.map(toPersistedChannel));
  let persistTimer: ReturnType<typeof setTimeout> | null = null;

  function persistWorkspaceState(): void {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    const state: PersistedState = {
      channels: persistedChannels.value,
      maxConcurrency: Math.min(8, Math.max(1, Math.round(maxConcurrency.value))),
      appSettings: { ...appSettings.value },
      recentDestinations: [...recentDestinations.value],
    };
    writeJson(STORAGE_KEY, state);
  }

  watch(
    [persistedChannels, maxConcurrency, appSettings, recentDestinations],
    () => {
      if (persistTimer) clearTimeout(persistTimer);
      persistTimer = setTimeout(persistWorkspaceState, 180);
    },
    { deep: true, immediate: true },
  );

  watch(
    () => [
      appSettings.value.theme,
      appSettings.value.density,
      appSettings.value.fontPreset,
      appSettings.value.customFontFamily,
      appSettings.value.fontWeight,
      appSettings.value.backgroundImageEnabled,
      appSettings.value.backgroundImagePath,
      appSettings.value.backgroundOpacity,
      appSettings.value.backgroundBlur,
      appSettings.value.backgroundOverlay,
      appSettings.value.backgroundFit,
      appSettings.value.backgroundPosition,
      appSettings.value.backgroundFocusX,
      appSettings.value.backgroundFocusY,
      appSettings.value.backgroundScale,
      appSettings.value.backgroundBrightness,
      appSettings.value.backgroundContrast,
      appSettings.value.backgroundSaturation,
      appSettings.value.backgroundVignette,
      appSettings.value.backgroundOverlayColor,
      appSettings.value.channelTransparencyEnabled,
      appSettings.value.channelPanelOpacity,
      appSettings.value.reduceMotion,
      appSettings.value.glassEffects,
      appSettings.value.compactTopbar,
    ],
    () => applyAppearanceSettings(appSettings.value),
    { immediate: true },
  );

  watch(
    () => appSettings.value.maxRecentDestinations,
    (value) => {
      const maxRecent = Math.max(3, Math.min(30, value));
      if (recentDestinations.value.length > maxRecent) recentDestinations.value = recentDestinations.value.slice(0, maxRecent);
    },
    { immediate: true },
  );

  watch(
    () => appSettings.value.taskHistoryRetention,
    (value) => taskCenter.trim(value),
    { immediate: true },
  );

  watch(
    () => appSettings.value.logRetention,
    (value) => notifications.setRetention(value),
    { immediate: true },
  );

  const flushBeforeUnload = () => persistWorkspaceState();
  window.addEventListener('beforeunload', flushBeforeUnload);
  onScopeDispose(() => {
    window.removeEventListener('beforeunload', flushBeforeUnload);
    persistWorkspaceState();
  });

  watch(maxConcurrency, (value) => {
    const normalized = Math.min(8, Math.max(1, Math.round(Number(value) || 1)));
    if (normalized !== value) maxConcurrency.value = normalized;
  });

  function channelStatus(channel: Channel) {
    return getChannelStatus(channel);
  }

  function channelProgress(channel: Channel): number {
    return getChannelProgress(channel);
  }

  function visibleFiles(channel: Channel): ArchiveFile[] {
    return getVisibleFiles(channel, appSettings.value);
  }

  function recordWorkspaceAction(label: string): void {
    history.capture(label, channels.value, presets.value);
  }

  function addChannel(category?: ChannelCategory): Channel {
    recordWorkspaceAction('新建通道');
    const channel = defaultChannel(channels.value.length + 1, appSettings.value, category ?? appSettings.value.defaultCategory);
    channels.value.push(channel);
    addLog({ level: 'info', channelName: channel.name, message: '已新建通道。' });
    return channel;
  }

  function duplicateChannel(channelId: string): Channel | null {
    const index = channels.value.findIndex((item) => item.id === channelId);
    if (index < 0) return null;
    recordWorkspaceAction('复制通道');
    const source = channels.value[index];
    const copy: Channel = {
      ...source,
      id: createId('channel'),
      name: `${source.name} 副本`,
      files: [],
      password: '',
      expanded: true,
      advancedOpen: source.advancedOpen,
      dragActive: false,
    };
    channels.value.splice(index + 1, 0, copy);
    addLog({ level: 'info', channelName: copy.name, message: `已复制“${source.name}”的通道配置。` });
    pushToast({ level: 'success', title: '通道已复制', message: copy.name });
    return copy;
  }

  function moveChannel(channelId: string, direction: -1 | 1): void {
    const index = channels.value.findIndex((item) => item.id === channelId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= channels.value.length) return;
    recordWorkspaceAction('调整通道顺序');
    const [channel] = channels.value.splice(index, 1);
    channels.value.splice(target, 0, channel);
  }

  function renameChannel(channelId: string, nextName: string, previousName?: string): void {
    const channel = channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    const normalized = nextName.trim() || previousName?.trim() || `通道 ${channels.value.indexOf(channel) + 1}`;
    const oldName = previousName ?? channel.name;
    if (oldName !== normalized) recordWorkspaceAction(`重命名通道：${oldName}`);
    channel.name = normalized;
    if (oldName !== normalized) addLog({ level: 'info', channelName: normalized, message: `通道已从“${oldName}”重命名。` });
  }

  function updateChannelCategory(channelId: string, category: ChannelCategory): void {
    const channel = channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    const definition = categoryDefinition(category);
    channel.category = category;
    channel.categoryColor = definition.color;
  }

  function removeChannel(channelId: string): void {
    const channel = channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    recordWorkspaceAction(`删除通道：${channel.name}`);
    for (const file of channel.files) {
      if (['processing', 'queued', 'paused'].includes(file.status)) void cancelJob(file.id);
    }
    channels.value = channels.value.filter((item) => item.id !== channelId);
    addLog({ level: 'warn', channelName: channel.name, message: '通道已删除。' });
    if (!channels.value.length) channels.value.push(defaultChannel(1, appSettings.value));
  }

  function toggleAllChannels(expanded: boolean): void {
    channels.value.forEach((channel) => {
      channel.expanded = expanded;
    });
  }

  function setDragActive(channelId: string, active: boolean): void {
    const channel = channels.value.find((item) => item.id === channelId);
    if (channel) channel.dragActive = active;
  }

  function setDestinationMode(channelId: string, mode: 'archive' | 'custom'): void {
    const channel = channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    channel.useArchiveDirectory = mode === 'archive';
  }

  function setDepthMode(channelId: string, mode: DepthModeType): void {
    const channel = channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    channel.depthMode = mode;
    if (mode === 'skipOuter' && appSettings.value.autoDirectForSkipOuter && channel.createArchiveSubfolder) {
      channel.createArchiveSubfolder = false;
      pushToast({
        level: 'info',
        title: '已关闭同名输出文件夹',
        message: '“跳过外层”将直接作用于目标目录；仍可在输出容器中重新开启。',
      });
    }
  }

  function setOutputContainer(channelId: string, createArchiveSubfolder: boolean): void {
    const channel = channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    channel.createArchiveSubfolder = createArchiveSubfolder;
  }

  function applyDirectOverwriteProfile(channelId: string): void {
    const channel = channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    channel.createArchiveSubfolder = false;
    channel.collisionPolicy = 'overwrite';
    channel.deduplicateArchiveRoot = true;
    pushToast({ level: 'success', title: '已启用直接覆盖', message: '不会额外创建压缩包同名文件夹；重名文件直接替换。' });
  }

  function applyIsolatedFolderProfile(channelId: string): void {
    const channel = channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    channel.createArchiveSubfolder = true;
    channel.collisionPolicy = 'overwrite';
    channel.deduplicateArchiveRoot = true;
    pushToast({ level: 'info', title: '已启用独立文件夹', message: '每个压缩包使用同名输出文件夹，并避免重复同名根目录。' });
  }

  function addRecentDestination(path: string): void {
    const normalized = normalizePathInput(path);
    if (!normalized) return;
    const requestedLimit = Number(appSettings.value.maxRecentDestinations);
    const limit = Number.isFinite(requestedLimit) ? Math.max(3, Math.min(30, Math.round(requestedLimit))) : 10;
    recentDestinations.value = [normalized, ...recentDestinations.value.filter((item) => item !== normalized)].slice(
      0,
      limit,
    );
  }

  function commitDestination(channelId: string, value?: string): void {
    const channel = channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    channel.destination = normalizePathInput(value ?? channel.destination);
    if (channel.destination) {
      channel.useArchiveDirectory = false;
      addRecentDestination(channel.destination);
    }
  }

  function applyRecentDestination(channelId: string, path: string): void {
    const channel = channels.value.find((item) => item.id === channelId);
    if (!channel || !path) return;
    channel.destination = path;
    channel.useArchiveDirectory = false;
    addRecentDestination(path);
  }

  function useFirstFileDirectory(channelId: string): void {
    const channel = channels.value.find((item) => item.id === channelId);
    const file = channel?.files[0];
    if (!channel || !file) {
      pushToast({ level: 'warn', title: '队列中还没有文件', message: '先添加一个压缩包，再从文件位置获取目录。' });
      return;
    }
    const path = parentDirectory(file.path);
    if (!path) return;
    channel.destination = path;
    channel.useArchiveDirectory = false;
    addRecentDestination(path);
    pushToast({ level: 'success', title: '已使用首个文件的目录', message: path });
  }

  async function browseDestination(channelId: string): Promise<void> {
    const channel = channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    channel.useArchiveDirectory = false;
    try {
      const path = await pickDirectory(channel.destination || appSettings.value.defaultDestination);
      if (path) {
        channel.destination = normalizePathInput(path);
        addRecentDestination(path);
        pushToast({ level: 'success', title: '解压目录已设置', message: channel.destination });
      }
    } catch (error) {
      const message = String(error);
      addLog({ level: 'error', channelName: channel.name, message: `打开目录选择器失败：${message}` });
      pushToast({ level: 'error', title: '无法打开目录选择器', message: '可直接在路径框中粘贴目录，或使用 Tauri 桌面模式。' });
    }
  }

  function commitDefaultDestination(): void {
    appSettings.value.defaultDestination = normalizePathInput(appSettings.value.defaultDestination);
    if (appSettings.value.defaultDestination) {
      appSettings.value.defaultUseArchiveDirectory = false;
      addRecentDestination(appSettings.value.defaultDestination);
    }
  }

  async function browseDefaultDestination(): Promise<void> {
    try {
      const path = await pickDirectory(appSettings.value.defaultDestination);
      if (!path) return;
      appSettings.value.defaultDestination = normalizePathInput(path);
      appSettings.value.defaultUseArchiveDirectory = false;
      addRecentDestination(path);
      pushToast({ level: 'success', title: '默认解压目录已设置', message: path });
    } catch (error) {
      pushToast({ level: 'error', title: '无法打开目录选择器', message: String(error) });
    }
  }

  function clearRecentDestinations(): void {
    recentDestinations.value = [];
    pushToast({ level: 'info', title: '最近目录已清空' });
  }

  function removeFile(channelId: string, fileId: string): void {
    const channel = channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    const file = channel.files.find((item) => item.id === fileId);
    if (!file) return;
    if (['processing', 'queued', 'paused'].includes(file.status)) void cancelJob(file.id);
    channel.files = channel.files.filter((item) => item.id !== fileId);
    addLog({ level: 'warn', channelName: channel.name, fileName: file.name, message: '已从队列移除。' });
  }

  function clearFinished(channelId: string): void {
    const channel = channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    channel.files = channel.files.filter((file) => !['success', 'cancelled'].includes(file.status));
  }

  function clearPending(channelId: string): void {
    const channel = channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    channel.files = channel.files.filter((file) => ['queued', 'processing', 'paused'].includes(file.status));
    addLog({ level: 'info', channelName: channel.name, message: '已清理未运行和已结束的队列项。' });
  }

  function clearAllFinished(): void {
    if (completedFiles.value > 0) recordWorkspaceAction('清理全部完成项');
    channels.value.forEach((channel) => clearFinished(channel.id));
    addLog({ level: 'info', message: '已清理所有通道中的完成和取消项。' });
  }

  function resetChannelSettings(channelId: string): void {
    const channel = channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    recordWorkspaceAction(`恢复通道默认：${channel.name}`);
    Object.assign(channel, {
      destination: appSettings.value.defaultDestination,
      useArchiveDirectory: appSettings.value.defaultUseArchiveDirectory,
      createArchiveSubfolder:
        appSettings.value.defaultDepthMode === 'skipOuter' && appSettings.value.autoDirectForSkipOuter
          ? false
          : appSettings.value.defaultCreateArchiveSubfolder,
      deduplicateArchiveRoot: appSettings.value.defaultDeduplicateArchiveRoot,
      collisionPolicy: appSettings.value.defaultCollisionPolicy,
      depthMode: appSettings.value.defaultDepthMode,
      depth: Number.isFinite(appSettings.value.defaultDepth) ? Math.max(0, Math.min(32, Math.round(appSettings.value.defaultDepth))) : 2,
      openAfter: appSettings.value.defaultOpenAfter,
      fileSort: appSettings.value.defaultFileSort as FileSortMode,
      skipJunkFiles: appSettings.value.defaultSkipJunkFiles,
      keepEmptyDirectories: appSettings.value.defaultKeepEmptyDirectories,
      inboxDirectory: appSettings.value.defaultInboxDirectory,
      inboxKeywords: '',
      inboxMatchMode: appSettings.value.defaultInboxMatchMode,
      inboxRecursive: appSettings.value.defaultInboxRecursive,
      inboxPreferHighestVersion: appSettings.value.defaultPreferHighestVersion,
      inboxIncludePrerelease: appSettings.value.defaultIncludePrerelease,
      inboxEnabled: false,
      autoStartEnabled: appSettings.value.autoStartAfterImport,
      autoLaunchClaudeAfterExtract: false,
      password: '',
    });
    pushToast({ level: 'info', title: '通道设置已恢复默认', message: channel.name });
  }

  function fallbackPreflight(jobs: ExtractionJobPayload[]): PreflightResult {
    return {
      jobs: jobs.map((job) => {
        const archiveName = job.archivePath.split(/[\\/]/).pop() || job.archivePath;
        const archiveParent = job.archivePath.replace(/[\\/][^\\/]+$/, '');
        const stem = archiveName.replace(/\.(tar\.(gz|bz2|xz)|tbz2?|tgz|txz|zip|rar|7z|tar|gz|bz2|xz)$/i, '') || '输出';
        const base = job.useArchiveDirectory ? archiveParent : job.destination;
        return {
          jobId: job.jobId,
          channelId: job.channelId,
          archivePath: job.archivePath,
          outputPath: job.createArchiveSubfolder ? `${base}/${stem}` : base,
          archiveSize: 0,
          estimatedRequiredBytes: 0,
          issues: [{ code: 'preview-mode', severity: 'info' as const, message: '浏览器预览模式无法读取磁盘空间，桌面版会执行完整自检。' }],
        };
      }),
      blockingIssueCount: 0,
      warningCount: 0,
    };
  }

  function requestStartReview(review: StartReviewState): Promise<boolean> {
    if (startReviewResolver) startReviewResolver(false);
    startReview.value = review;
    return new Promise((resolve) => {
      startReviewResolver = resolve;
    });
  }

  function confirmStartReview(): void {
    const current = startReview.value;
    if (!current) return;
    const localBlocking = current.localIssues.some((issue) => issue.severity === 'error');
    if (current.preflight.blockingIssueCount > 0 || localBlocking) return;
    startReview.value = null;
    startReviewResolver?.(true);
    startReviewResolver = null;
  }

  function cancelStartReview(): void {
    startReview.value = null;
    startReviewResolver?.(false);
    startReviewResolver = null;
  }

  async function reviewJobs(
    jobs: ExtractionJobPayload[],
    selectedChannels: Channel[],
    automatic = false,
    automaticContext = '自动开始',
  ): Promise<boolean> {
    const unsupportedCount = selectedChannels.reduce(
      (sum, channel) => sum + channel.files.filter((file) => !file.supported).length,
      0,
    );
    const localIssues: PreflightIssue[] = unsupportedCount
      ? [{ code: 'unsupported-skipped', severity: 'warning' as const, message: `${unsupportedCount} 个不支持的文件不会进入任务队列。` }]
      : [];
    let preflight: PreflightResult;
    if (appSettings.value.preflightEnabled) {
      try {
        preflight = await preflightJobs({
          jobs,
          checkPassword: appSettings.value.preflightCheckPassword,
          checkDiskSpace: appSettings.value.preflightCheckDiskSpace,
          checkConflicts: appSettings.value.preflightCheckConflicts,
          minimumFreeBytes: Math.max(0, appSettings.value.preflightMinimumFreeMb) * 1024 * 1024,
          spaceMultiplier: Math.max(1, Math.min(10, Math.round(appSettings.value.preflightSpaceMultiplier))),
        });
      } catch (error) {
        preflight = fallbackPreflight(jobs);
        localIssues.push({ code: 'preflight-unavailable', severity: 'warning', message: `完整自检不可用：${String(error)}` });
      }
    } else {
      preflight = fallbackPreflight(jobs);
      preflight.jobs.forEach((job) => { job.issues = []; });
    }
    const localBlocking = localIssues.filter((issue) => issue.severity === 'error').length;
    if (automatic) {
      if (preflight.blockingIssueCount + localBlocking > 0) {
        pushToast({
          level: 'error',
          title: `${automaticContext}被开始前自检阻止`,
          message: `发现 ${preflight.blockingIssueCount + localBlocking} 个阻止项，请修正后手动开始。`,
          timeoutMs: 8000,
        });
        return false;
      }
      const warnings = preflight.warningCount + localIssues.filter((issue) => issue.severity === 'warning').length;
      if (warnings > 0) {
        pushToast({
          level: 'warn',
          title: `${automaticContext}已通过自检并继续`,
          message: `有 ${warnings} 个警告，详情可在任务中心和日志中查看。`,
          timeoutMs: 6500,
        });
      }
      return true;
    }
    const shouldReview = appSettings.value.showOutputPreviewBeforeStart
      || preflight.blockingIssueCount > 0
      || preflight.warningCount > 0
      || localIssues.length > 0;
    if (!shouldReview) return true;
    return requestStartReview({ title: `开始前检查 · ${jobs.length} 个任务`, jobs, preflight, localIssues });
  }

  async function runChannels(
    selectedChannels: Channel[],
    statuses: FileStatus[] = ['pending', 'error', 'cancelled'],
    automatic = false,
    automaticContext = '自动开始',
  ): Promise<boolean> {
    const allowed = new Set<FileStatus>(statuses);
    const runnableChannels = selectedChannels.filter((channel) =>
      channel.files.some((file) => file.supported && allowed.has(file.status)),
    );
    const invalid = runnableChannels.filter(
      (channel) => !channel.useArchiveDirectory && !normalizePathInput(channel.destination),
    );
    invalid.forEach((channel) => {
      channel.expanded = true;
      addLog({ level: 'warn', channelName: channel.name, message: '尚未设置指定解压目录，已跳过启动。' });
    });
    if (invalid.length) {
      pushToast({
        level: 'warn',
        title: `${invalid.length} 个通道缺少解压目录`,
        message: '已展开相关通道，请选择目录后重试。',
      });
    }
    const ready = runnableChannels.filter((channel) => !invalid.includes(channel));
    const jobs = buildJobs(ready, appSettings.value.queueStrategy, statuses, appSettings.value.enableFilePriority);
    if (!jobs.length) return false;
    const acceptedByReview = await reviewJobs(jobs, selectedChannels, automatic, automaticContext);
    if (!acceptedByReview) return false;
    const overwriteChannels = ready.filter((channel) => channel.collisionPolicy === 'overwrite' && jobs.some((job) => job.channelId === channel.id));
    if (overwriteChannels.length && appSettings.value.confirmBeforeOverwrite && !automatic) {
      const accepted = window.confirm(`有 ${overwriteChannels.length} 个通道会直接替换目标目录中的同名文件。确定继续吗？`);
      if (!accepted) return false;
    }
    const channelNames = new Map(ready.map((channel) => [channel.id, channel.name]));
    const fileNames = new Map(ready.flatMap((channel) => channel.files.map((file) => [file.id, file.name] as const)));
    taskCenter.enqueue(jobs, channelNames, fileNames, appSettings.value.taskHistoryRetention);
    for (const job of jobs) {
      const channel = channels.value.find((item) => item.id === job.channelId);
      const file = channel?.files.find((item) => item.id === job.jobId);
      if (file) {
        file.status = 'queued';
        file.progress = 0;
        file.message = '已排队';
      }
    }
    try {
      const batchId = await startBatch({ jobs, maxConcurrency: maxConcurrency.value });
      activeBatchIds.value.push(batchId);
      taskCenter.attachBatch(batchId, jobs.map((job) => job.jobId));
      addLog({ level: 'info', message: `已提交批次 ${batchId.slice(0, 8)}，共 ${jobs.length} 个任务。` });
      pushToast({ level: 'info', title: `已开始 ${jobs.length} 个任务`, message: `最大并发 ${maxConcurrency.value}` });
      return true;
    } catch (error) {
      const message = String(error);
      for (const job of jobs) {
        const channel = channels.value.find((item) => item.id === job.channelId);
        const file = channel?.files.find((item) => item.id === job.jobId);
        if (file) {
          file.status = 'error';
          file.message = message;
        }
      }
      taskCenter.failToStart(jobs.map((job) => job.jobId), message);
      addLog({ level: 'error', message: `启动批次失败：${message}` });
      pushToast({ level: 'error', title: '启动任务失败', message });
      return false;
    }
  }

  function resetFileForRerun(file: ArchiveFile): void {
    file.status = 'pending';
    file.progress = 0;
    file.message = '等待按当前设置重新解压';
    file.outputPath = undefined;
    file.manifestPath = undefined;
    file.writtenFiles = undefined;
    file.replacedFiles = undefined;
    file.outputDeleted = false;
  }

  async function rerunFile(fileId: string): Promise<void> {
    const found = findFile(fileId);
    if (!found || !found.file.supported || ['queued', 'processing', 'paused'].includes(found.file.status)) return;
    resetFileForRerun(found.file);
    addLog({
      level: 'info',
      channelName: found.channel.name,
      fileName: found.file.name,
      message: '按当前输出容器、层级和重名策略重新解压。旧输出不会自动删除。',
    });
    pushToast({
      level: 'info',
      title: `重新解压 ${found.file.name}`,
      message: '将按当前设置写入；旧目录不会自动清理。',
    });
    await runChannels([{ ...found.channel, files: [found.file] }], ['pending']);
  }

  async function rerunChannel(channelId: string): Promise<void> {
    const channel = channels.value.find((item) => item.id === channelId);
    if (!channel || channel.files.some((file) => ['queued', 'processing', 'paused'].includes(file.status))) return;
    const rerunnable = channel.files.filter((file) => file.supported);
    if (!rerunnable.length) return;
    rerunnable.forEach(resetFileForRerun);
    channel.expanded = true;
    addLog({
      level: 'info',
      channelName: channel.name,
      message: `准备按当前设置重新解压 ${rerunnable.length} 个文件；旧输出不会自动删除。`,
    });
    pushToast({
      level: 'info',
      title: `重新运行“${channel.name}”`,
      message: '新结果会按当前层级写入；此前生成的旧目录需按需手动清理。',
      timeoutMs: 6500,
    });
    await runChannels([channel], ['pending']);
  }

  async function pauseFile(fileId: string): Promise<void> {
    if (!appSettings.value.enablePauseResume) return;
    const found = findFile(fileId);
    if (!found || !['queued', 'processing'].includes(found.file.status)) return;
    try {
      if (await pauseJob(fileId)) {
        found.file.status = 'paused';
        found.file.message = '已暂停';
        taskCenter.markPaused(fileId);
      }
    } catch (error) {
      pushToast({ level: 'error', title: '暂停任务失败', message: String(error) });
    }
  }

  async function resumeFile(fileId: string): Promise<void> {
    const found = findFile(fileId);
    if (!found || found.file.status !== 'paused') return;
    try {
      if (await resumeJob(fileId)) {
        found.file.status = found.file.progress > 0 ? 'processing' : 'queued';
        found.file.message = '已继续';
        taskCenter.markResumed(fileId);
      }
    } catch (error) {
      pushToast({ level: 'error', title: '继续任务失败', message: String(error) });
    }
  }

  async function pauseChannel(channelId: string): Promise<void> {
    const channel = channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    await Promise.all(channel.files.filter((file) => ['queued', 'processing'].includes(file.status)).map((file) => pauseFile(file.id)));
  }

  async function resumeChannel(channelId: string): Promise<void> {
    const channel = channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    await Promise.all(channel.files.filter((file) => file.status === 'paused').map((file) => resumeFile(file.id)));
  }

  function applySnapshotToChannel(channel: Channel, snapshot: Omit<ExtractionJobPayload, 'password'>): void {
    channel.destination = snapshot.destination;
    channel.useArchiveDirectory = snapshot.useArchiveDirectory;
    channel.createArchiveSubfolder = snapshot.createArchiveSubfolder;
    channel.deduplicateArchiveRoot = snapshot.deduplicateArchiveRoot;
    channel.collisionPolicy = snapshot.collisionPolicy;
    channel.depthMode = snapshot.depthMode.type === 'flatten' ? 'flatten' : snapshot.depthMode.type;
    channel.depth = snapshot.depthMode.type === 'flatten' ? snapshot.depthMode.depth : channel.depth;
    channel.openAfter = snapshot.openAfter;
    channel.skipJunkFiles = snapshot.skipJunkFiles;
    channel.keepEmptyDirectories = snapshot.keepEmptyDirectories;
    channel.expanded = true;
  }

  async function restoreTaskRecord(record: TaskRecord): Promise<{ channel: Channel; file: ArchiveFile } | null> {
    const snapshot = record.jobSnapshot;
    if (!snapshot) {
      pushToast({ level: 'warn', title: '无法自动恢复旧版任务', message: '这条记录没有任务快照，请重新导入压缩包。' });
      return null;
    }
    let inspected;
    try {
      [inspected] = await inspectFiles([snapshot.archivePath]);
    } catch (error) {
      pushToast({ level: 'error', title: '恢复检查失败', message: String(error) });
      return null;
    }
    if (!inspected?.supported) {
      pushToast({ level: 'error', title: '无法恢复任务', message: `源文件不存在或格式不受支持：${snapshot.archivePath}` });
      return null;
    }
    let channel = channels.value.find((item) => item.id === snapshot.channelId);
    if (!channel) {
      channel = defaultChannel(channels.value.length + 1, appSettings.value, 'general');
      channel.id = snapshot.channelId;
      channel.name = `恢复 · ${record.channelName}`;
      channels.value.push(channel);
    }
    applySnapshotToChannel(channel, snapshot);
    const existing = channel.files.find((file) => file.path === inspected.path && !['success', 'processing', 'queued', 'paused'].includes(file.status));
    const file: ArchiveFile = existing || {
      id: createId('job'),
      ...inspected,
      status: 'pending',
      progress: 0,
      message: record.status === 'interrupted' ? '从中断任务恢复' : '从任务历史重新运行',
      priority: 'high',
    };
    if (!existing) channel.files.push(file);
    else {
      file.status = 'pending';
      file.progress = 0;
      file.message = record.status === 'interrupted' ? '从中断任务恢复' : '从任务历史重新运行';
      file.priority = 'high';
    }
    return { channel, file };
  }

  async function resumeInterruptedTask(recordId: string): Promise<void> {
    const record = taskCenter.records.find((item) => item.id === recordId && item.status === 'interrupted');
    if (!record) return;
    if (appSettings.value.confirmBeforeResumeInterrupted && !window.confirm(`恢复“${record.fileName}”并重新提交吗？`)) return;
    const restored = await restoreTaskRecord(record);
    if (!restored) return;
    if (record.requiresPassword) {
      restored.channel.expanded = true;
      taskCenter.markRecovered(record.id, false);
      pushToast({ level: 'warn', title: '任务已恢复到工作区', message: '原任务使用过密码。为保护隐私，密码未保存，请重新输入后开始。' });
      return;
    }
    const started = await runChannels([{ ...restored.channel, files: [restored.file] }], ['pending']);
    if (started) taskCenter.markRecovered(record.id);
  }

  async function rerunTaskRecord(recordId: string): Promise<void> {
    const record = taskCenter.records.find((item) => item.id === recordId);
    if (!record || ['queued', 'processing', 'paused'].includes(record.status)) return;
    const current = findFile(record.jobId);
    if (current && current.file.supported && !['queued', 'processing', 'paused'].includes(current.file.status)) {
      await rerunFile(current.file.id);
      return;
    }
    const restored = await restoreTaskRecord(record);
    if (!restored) return;
    if (record.requiresPassword) {
      restored.channel.expanded = true;
      pushToast({ level: 'warn', title: '任务已放回工作区', message: '密码不会保存在历史中，请重新输入后开始。' });
      return;
    }
    await runChannels([{ ...restored.channel, files: [restored.file] }], ['pending']);
  }

  async function resumeInterruptedTasks(automatic = false): Promise<void> {
    const records = [...taskCenter.recoverableRecords];
    if (!records.length) return;
    if (!automatic && appSettings.value.confirmBeforeResumeInterrupted && !window.confirm(`恢复 ${records.length} 个中断任务吗？需要密码的任务只会恢复到工作区。`)) return;
    const runnable: Channel[] = [];
    const recordsWithoutPassword: TaskRecord[] = [];
    let passwordCount = 0;
    for (const record of records) {
      const restored = await restoreTaskRecord(record);
      if (!restored) continue;
      if (record.requiresPassword) {
        passwordCount += 1;
        taskCenter.markRecovered(record.id, false);
        continue;
      }
      runnable.push({ ...restored.channel, files: [restored.file] });
      recordsWithoutPassword.push(record);
    }
    if (passwordCount) pushToast({ level: 'warn', title: `${passwordCount} 个任务需要重新输入密码`, message: '已恢复到对应通道，但不会自动开始。' });
    if (runnable.length) {
      const started = await runChannels(runnable, ['pending'], automatic, '自动恢复');
      if (started) recordsWithoutPassword.forEach((record) => taskCenter.markRecovered(record.id));
    }
  }

  async function cancelFile(fileId: string): Promise<void> {
    try {
      const cancelled = await cancelJob(fileId);
      if (cancelled) {
        const found = findFile(fileId);
        if (found) {
          found.file.status = 'cancelled';
          found.file.message = '已请求取消';
        }
      }
    } catch (error) {
      const found = findFile(fileId);
      addLog({
        level: 'error',
        channelName: found?.channel.name,
        fileName: found?.file.name,
        message: `取消任务失败：${String(error)}`,
      });
    }
  }

  async function cancelChannel(channelId: string): Promise<void> {
    const channel = channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    await Promise.all(channel.files.filter((file) => ['queued', 'processing', 'paused'].includes(file.status)).map((file) => cancelFile(file.id)));
  }

  function findFile(jobId: string) {
    return findArchiveFile(channels.value, jobId);
  }

  function onProgress(event: ProgressEvent): void {
    taskCenter.onProgress(event);
    const found = findFile(event.jobId);
    if (!found) return;
    found.file.status = event.phase === 'queued' ? 'queued' : event.phase === 'paused' ? 'paused' : event.phase === 'finished' ? found.file.status : 'processing';
    found.file.progress = Math.max(found.file.progress, Math.min(100, Math.round(event.progress)));
    found.file.message = event.message;
  }
  function onJobFinished(event: JobFinishedEvent): void {
    taskCenter.onJobFinished(event);
    const found = findFile(event.jobId);
    if (!found) return;
    found.file.progress = event.success ? 100 : found.file.progress;
    found.file.status = event.success ? 'success' : event.error === '任务已取消' ? 'cancelled' : 'error';
    found.file.message = event.success ? `完成 · ${(event.durationMs / 1000).toFixed(1)}s` : event.error || '解压失败';
    found.file.outputPath = event.outputPath;
    found.file.manifestPath = event.manifestPath;
    found.file.writtenFiles = event.writtenFiles;
    found.file.replacedFiles = event.replacedFiles;
    found.file.outputDeleted = false;
    if (event.success && event.outputPath) {
      const tracked = projectCenter.addOrUpdateProject({
        path: event.outputPath,
        sourceChannelId: found.channel.id,
        sourceChannelName: found.channel.name,
        sourceFileName: found.file.name,
        extractedAt: new Date().toISOString(),
      });
      if (tracked?.created) addLog({
        level: 'info', channelName: found.channel.name, fileName: found.file.name,
        message: `已自动加入项目中心：${event.outputPath}`,
      });
      if (found.channel.autoLaunchClaudeAfterExtract) void launchClaudeAfterExtraction(event.outputPath, found.channel.name, found.file.name);
    }
    if (!event.success && appSettings.value.autoExpandOnError) found.channel.expanded = true;
    if (!event.success && appSettings.value.autoOpenTaskCenterOnFailure) taskCenter.drawerOpen = true;
    if (event.success && appSettings.value.autoCollapseSuccessful && found.channel.files.length > 0 && found.channel.files.every((file) => file.status === 'success')) {
      found.channel.expanded = false;
    }
    addLog({
      level: event.success ? 'success' : found.file.status === 'cancelled' ? 'warn' : 'error',
      channelName: found.channel.name,
      fileName: found.file.name,
      message: event.success ? `解压完成，输出到 ${event.outputPath}` : `处理失败：${event.error || '未知错误'}`,
    });
    if (!event.success && found.file.status !== 'cancelled' && appSettings.value.errorToasts) {
      pushToast({ level: 'error', title: `${found.file.name} 解压失败`, message: found.file.message, timeoutMs: 7000 });
    }
  }

  function onBatchFinished(event: BatchFinishedEvent): void {
    taskCenter.onBatchFinished(event);
    activeBatchIds.value = activeBatchIds.value.filter((id) => id !== event.batchId);
    addLog({
      level: event.failed ? 'warn' : 'success',
      message: `批次完成：成功 ${event.succeeded}，失败 ${event.failed}，取消 ${event.cancelled}。`,
    });
    if ((event.failed && appSettings.value.errorToasts) || (!event.failed && appSettings.value.successToasts)) {
      pushToast({
        level: event.failed ? 'warn' : 'success',
        title: event.failed ? '批次完成，但有失败任务' : '批次已完成',
        message: `成功 ${event.succeeded} · 失败 ${event.failed} · 取消 ${event.cancelled}`,
        timeoutMs: 6500,
      });
    }
    if (appSettings.value.autoClearCompleted && event.succeeded > 0) {
      window.setTimeout(() => clearAllFinished(), 1800);
    }
  }

  function applyChannelSettingsToAll(channelId: string): void {
    const source = channels.value.find((item) => item.id === channelId);
    if (!source) return;
    recordWorkspaceAction(`应用到全部通道：${source.name}`);
    const settings = {
      destination: source.destination,
      useArchiveDirectory: source.useArchiveDirectory,
      createArchiveSubfolder: source.createArchiveSubfolder,
      deduplicateArchiveRoot: source.deduplicateArchiveRoot,
      collisionPolicy: source.collisionPolicy,
      depthMode: source.depthMode,
      depth: source.depth,
      fileSort: source.fileSort,
      openAfter: source.openAfter,
      skipJunkFiles: source.skipJunkFiles,
      keepEmptyDirectories: source.keepEmptyDirectories,
      inboxDirectory: source.inboxDirectory,
      inboxKeywords: source.inboxKeywords,
      inboxMatchMode: source.inboxMatchMode,
      inboxRecursive: source.inboxRecursive,
      inboxPreferHighestVersion: source.inboxPreferHighestVersion,
      inboxIncludePrerelease: source.inboxIncludePrerelease,
      inboxEnabled: source.inboxEnabled,
      autoStartEnabled: source.autoStartEnabled,
      autoLaunchClaudeAfterExtract: source.autoLaunchClaudeAfterExtract,
    };
    channels.value.forEach((channel) => {
      if (channel.id !== source.id) Object.assign(channel, settings);
    });
    pushToast({ level: 'success', title: '设置已应用到全部通道', message: `以“${source.name}”为模板` });
    addLog({ level: 'info', channelName: source.name, message: '已将输出与解压设置应用到全部通道。' });
  }

  const { applyChannelAutomationProfile, undoLastAction } = createChannelWorkspaceActions({
    channels,
    appSettings,
    processingFiles,
    presets,
    history,
    recordWorkspaceAction,
    addLog,
    pushToast,
  });

  const { addPathsToChannel, browseFiles } = createChannelImportActions({
    channels,
    appSettings,
    runChannels,
    addLog,
    pushToast,
  });

  const {
    inboxScanResults,
    inboxScanningIds,
    browseDefaultInboxDirectory,
    useSystemDownloadsAsDefault,
    applyInboxDefaultsToChannels,
    browseInboxDirectory,
    useSystemDownloadsForChannel,
    latestInboxResult,
    openInboxDirectory,
    clearInboxScanResult,
    scanChannelInbox,
    importInboxCandidate,
    scanAllKeywordChannels,
  } = createChannelInboxActions({
    channels,
    appSettings,
    addPathsToChannel,
    addLog,
    pushToast,
  });

  const { scanLatestAndStartChannel, startChannel, startAll, startFailed } = createChannelStartActions({
    channels,
    appSettings,
    hasRunnableFiles,
    canScanLatest,
    scanChannelInbox,
    runChannels,
    pushToast,
    noteAction: history.note,
  });

  const { routePathsToChannels } = createChannelRoutingActions({
    channels,
    appSettings,
    addPathsToChannel,
    addLog,
    pushToast,
  });

  const { openFileOutput, openChannelOutput, deleteChannelOutputs, deleteFileOutput } = createChannelOutputActions({
    channels,
    appSettings,
    addLog,
    pushToast,
    markTaskOutputDeleted: taskCenter.markOutputDeleted,
  });

  const {
    latestExtractedDirectory, channelClaudeDirectory,
    generateClaudeDatAt,
    checkClaudeAvailability,
    launchClaudeAt, launchClaudeAfterExtraction,
    browseClaudeToolsDirectory,
    generateClaudeDatForChannel,
    launchClaudeForChannel,
    launchClaudeForFile,
  } = createChannelProjectTools({
    channels,
    appSettings,
    addRecentDestination,
    addLog,
    pushToast,
  });

  const {
    savePreset,
    applyPreset,
    deletePreset,
    renamePreset,
    duplicatePreset,
    movePreset,
    exportConfiguration,
    importConfiguration,
    exportTemplates,
    importTemplates,
    resetAppSettings,
    resetWorkspace,
  } = createChannelConfigurationActions({
    channels,
    appSettings,
    maxConcurrency,
    recentDestinations,
    presets,
    processingFiles,
    addRecentDestination,
    addLog,
    pushToast,
    recordHistory: recordWorkspaceAction,
    noteHistory: history.note,
  });

  return {
    channels,
    maxConcurrency,
    recentDestinations,
    appSettings,
    logs,
    presets,
    toasts,
    logDrawerOpen,
    settingsOpen,
    activeBatchIds,
    inboxScanResults,
    inboxScanningIds,
    startReview,
    totalFiles,
    processingFiles,
    failedFiles,
    completedFiles,
    hasRunnableFiles,
    hasScannableChannels,
    hasAutoScannableChannels,
    hasStartableWork,
    canScanLatest,
    channelStatus,
    channelProgress,
    visibleFiles,
    addChannel,
    duplicateChannel,
    moveChannel,
    renameChannel,
    updateChannelCategory,
    removeChannel,
    toggleAllChannels,
    setDragActive,
    setDestinationMode,
    setDepthMode,
    setOutputContainer,
    applyDirectOverwriteProfile,
    applyIsolatedFolderProfile,
    commitDestination,
    applyRecentDestination,
    useFirstFileDirectory,
    addPathsToChannel,
    routePathsToChannels,
    browseFiles,
    browseDestination,
    browseDefaultInboxDirectory,
    useSystemDownloadsAsDefault,
    applyInboxDefaultsToChannels,
    browseInboxDirectory,
    useSystemDownloadsForChannel,
    latestInboxResult,
    openInboxDirectory,
    clearInboxScanResult,
    scanChannelInbox,
    importInboxCandidate,
    scanAllKeywordChannels,
    browseDefaultDestination,
    commitDefaultDestination,
    clearRecentDestinations,
    removeFile,
    clearFinished,
    clearPending,
    clearAllFinished,
    resetChannelSettings,
    applyChannelAutomationProfile,
    undoLastAction,
    startChannel,
    scanLatestAndStartChannel,
    rerunFile,
    rerunChannel,
    startAll,
    startFailed,
    pauseFile,
    resumeFile,
    pauseChannel,
    resumeChannel,
    resumeInterruptedTask,
    rerunTaskRecord,
    resumeInterruptedTasks,
    confirmStartReview,
    cancelStartReview,
    cancelFile,
    cancelChannel,
    onProgress,
    onJobFinished,
    onBatchFinished,
    exportLogs,
    openFileOutput,
    openChannelOutput,
    deleteFileOutput,
    deleteChannelOutputs,
    latestExtractedDirectory, channelClaudeDirectory,
    generateClaudeDatAt,
    checkClaudeAvailability,
    launchClaudeAt, launchClaudeAfterExtraction,
    browseClaudeToolsDirectory,
    generateClaudeDatForChannel,
    launchClaudeForChannel,
    launchClaudeForFile,
    applyChannelSettingsToAll,
    savePreset,
    applyPreset,
    deletePreset,
    renamePreset,
    duplicatePreset,
    movePreset,
    exportConfiguration,
    importConfiguration,
    exportTemplates,
    importTemplates,
    resetAppSettings,
    resetWorkspace,
    pushToast, dismissToast,
  };
});
