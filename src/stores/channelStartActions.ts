import type { Ref } from 'vue';
import type { AppSettings, ArchiveDirectoryScanResult, Channel, FileStatus, ToastMessage } from '../types';

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
  pushToast: PushToast;
  noteAction?: (label: string) => void;
}

export function createChannelStartActions(deps: ChannelStartDependencies) {
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

  return { scanLatestAndStartChannel, startChannel, startAll, startFailed };
}
