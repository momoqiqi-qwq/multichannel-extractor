import type { Ref } from 'vue';
import type { AddPathsToChannelOptions } from './channelImportActions';
import type {
  AppSettings,
  ArchiveDirectoryScanResult,
  Channel,
  FileStatus,
  ScanHistoryEntry,
  ToastMessage,
} from '../types';

const SCAN_HISTORY_LIMIT = 30;

type PushToast = (toast: Omit<ToastMessage, 'id'>) => void;
type RunChannels = (
  channels: Channel[],
  statuses?: FileStatus[],
  automatic?: boolean,
  automaticContext?: string,
) => Promise<boolean>;
type ScanChannelInbox = (
  channelId: string,
  silent?: boolean,
  options?: { forceImportSelected?: boolean; suppressImportedAutoStart?: boolean },
) => Promise<ArchiveDirectoryScanResult | null>;

interface ChannelStartDependencies {
  channels: Ref<Channel[]>;
  appSettings: Ref<AppSettings>;
  hasRunnableFiles: Readonly<Ref<boolean>>;
  canScanLatest: (channel: Channel) => boolean;
  scanChannelInbox: ScanChannelInbox;
  runChannels: RunChannels;
  addPathsToChannel: (channelId: string, paths: string[], options?: AddPathsToChannelOptions) => Promise<void>;
  pushToast: PushToast;
  noteAction?: (label: string) => void;
}

export function createChannelStartActions(deps: ChannelStartDependencies) {
  function recordScanHistory(channel: Channel, result: ArchiveDirectoryScanResult): void {
    if (!result.selectedPath) return;
    const entry: ScanHistoryEntry = {
      id: `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      scannedAt: new Date().toISOString(),
      directory: result.directory,
      keywords: [...result.keywords],
      scannedFiles: result.scannedFiles,
      matchedFiles: result.matchedFiles,
      selectedName: result.selectedName,
      selectedPath: result.selectedPath,
      selectionReason: result.selectionReason,
      candidates: result.candidates.map((c) => ({ ...c })),
    };
    const next = [...channel.scanHistory, entry];
    channel.scanHistory = next.length > SCAN_HISTORY_LIMIT ? next.slice(-SCAN_HISTORY_LIMIT) : next;
  }

  async function scanLatestAndStartChannel(
    channelId: string,
    showSearchingToast = true,
    startAfterScan = true,
  ): Promise<boolean> {
    const channel = deps.channels.value.find((item) => item.id === channelId);
    if (!channel || !deps.canScanLatest(channel)) return false;
    if (showSearchingToast) {
      deps.noteAction?.(`扫描最新版并开始：${channel.name}`);
      deps.pushToast({ level: 'info', title: '正在查找最新版', message: `${channel.name} · 扫描关键词收件目录` });
    }
    const result = await deps.scanChannelInbox(channel.id, true, {
      forceImportSelected: true,
      suppressImportedAutoStart: true,
    });
    if (!result?.selectedPath) {
      if (showSearchingToast) {
        deps.pushToast({ level: 'info', title: '没有找到可开始的最新版', message: `${channel.name} · 请检查关键词或收件目录。` });
      }
      return false;
    }
    recordScanHistory(channel, result);
    if (!startAfterScan) return true;
    return deps.runChannels([channel], ['pending', 'error', 'cancelled'], true, '扫描最新版后自动开始');
  }

  async function startChannel(channelId: string): Promise<void> {
    const channel = deps.channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    const hasRunnable = channel.files.some((file) => file.supported && ['pending', 'error', 'cancelled'].includes(file.status));
    if (hasRunnable) {
      deps.noteAction?.(`开始通道：${channel.name}`);
      await deps.runChannels([channel]);
      return;
    }
    if (!deps.canScanLatest(channel)) {
      deps.pushToast({ level: 'info', title: '没有可开始的文件', message: '拖入压缩包，或先配置关键词收件目录与关键词。' });
      return;
    }
    if (!deps.appSettings.value.scanLatestOnEmptyStart) {
      deps.pushToast({
        level: 'info',
        title: '空队列自动扫描已关闭',
        message: '可在“总设置 → 操作与导航”打开“空队列开始时扫描最新版”，或使用扫描收件开关。',
      });
      return;
    }
    await scanLatestAndStartChannel(channel.id);
  }

  async function startAll(): Promise<void> {
    deps.noteAction?.('全部开始');
    const hadRunnableFiles = deps.hasRunnableFiles.value;
    const emptyScannable = deps.appSettings.value.scanLatestOnEmptyStart
      ? deps.channels.value.filter((channel) => {
          const hasRunnable = channel.files.some((file) => file.supported && ['pending', 'error', 'cancelled'].includes(file.status));
          return !hasRunnable && deps.canScanLatest(channel);
        })
      : [];

    let scannedMatches = 0;
    if (emptyScannable.length) {
      deps.pushToast({
        level: 'info',
        title: hadRunnableFiles ? '正在补齐空通道的最新版' : '正在扫描最新版',
        message: `${emptyScannable.length} 个关键词通道`,
      });
      for (const channel of emptyScannable) {
        if (await scanLatestAndStartChannel(channel.id, false, false)) scannedMatches += 1;
      }
    }

    if (!deps.hasRunnableFiles.value) {
      deps.pushToast({
        level: 'info',
        title: '没有可开始的文件',
        message: emptyScannable.length
          ? '未在已配置的关键词收件目录中找到匹配压缩包。'
          : deps.appSettings.value.scanLatestOnEmptyStart
            ? '拖入压缩包，或配置关键词收件后直接点开始。'
            : '请先导入压缩包，或打开“空队列开始时扫描最新版”开关。',
      });
      return;
    }

    await deps.runChannels(
      deps.channels.value,
      ['pending', 'error', 'cancelled'],
      !hadRunnableFiles && scannedMatches > 0,
      '扫描最新版后自动开始',
    );
  }

  async function startFailed(): Promise<void> {
    deps.noteAction?.('重试失败任务');
    await deps.runChannels(deps.channels.value, ['error']);
  }

  function clearChannelScanHistory(channelId: string): void {
    const channel = deps.channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    channel.scanHistory = [];
  }

  function removeScanHistoryEntry(channelId: string, entryId: string): void {
    const channel = deps.channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    channel.scanHistory = channel.scanHistory.filter((entry) => entry.id !== entryId);
  }

  /** 重新扫描当前关键词收件目录（用通道当前配置），会追加一条新历史。 */
  async function rescanFromHistory(channelId: string): Promise<boolean> {
    return scanLatestAndStartChannel(channelId, true, true);
  }

  /** 把某条历史记录里选中的压缩包重新加入队列并立即开始。 */
  async function requeueFromHistory(channelId: string, entryId: string): Promise<boolean> {
    const channel = deps.channels.value.find((item) => item.id === channelId);
    if (!channel) return false;
    const entry = channel.scanHistory.find((item) => item.id === entryId);
    if (!entry?.selectedPath) {
      deps.pushToast({ level: 'info', title: '该条历史没有可加入的文件', message: '请改用「重新扫描」查找最新版。' });
      return false;
    }
    deps.noteAction?.(`重新加入：${entry.selectedName || entry.selectedPath}`);
    await deps.addPathsToChannel(channel.id, [entry.selectedPath], { allowAutoStart: false });
    return deps.runChannels([channel], ['pending', 'error', 'cancelled'], true, '从扫描历史重新加入');
  }

  return {
    scanLatestAndStartChannel,
    startChannel,
    startAll,
    startFailed,
    clearChannelScanHistory,
    removeScanHistoryEntry,
    rescanFromHistory,
    requeueFromHistory,
  };
}
