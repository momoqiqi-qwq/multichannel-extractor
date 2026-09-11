import { ref, type Ref } from 'vue';
import { getDownloadDirectory, openOutput, pickDirectory, scanArchiveDirectory } from '../services/tauri';
import { normalizePathInput } from '../utils/path';
import type {
  AppSettings,
  ArchiveDirectoryScanResult,
  Channel,
  LogEntry,
  ToastMessage,
} from '../types';
import type { AddPathsToChannelOptions } from './channelImportActions';

type AddLog = (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
type PushToast = (toast: Omit<ToastMessage, 'id'>) => void;

interface InboxDependencies {
  channels: Ref<Channel[]>;
  appSettings: Ref<AppSettings>;
  addPathsToChannel: (channelId: string, paths: string[], options?: AddPathsToChannelOptions) => Promise<void>;
  addLog: AddLog;
  pushToast: PushToast;
}

interface ScanChannelInboxOptions {
  forceImportSelected?: boolean;
  suppressImportedAutoStart?: boolean;
}

export function createChannelInboxActions(deps: InboxDependencies) {
  const inboxScanResults = ref<Record<string, ArchiveDirectoryScanResult & { scannedAt: string }>>({});
  const inboxScanningIds = ref<string[]>([]);

  function parseInboxKeywords(value: string): string[] {
    return value
      .split(/[\n\r,;，；]+/)
      .map((item) => item.trim())
      .filter((item, index, list) => Boolean(item) && list.indexOf(item) === index);
  }

  async function browseDefaultInboxDirectory(): Promise<void> {
    try {
      const selected = await pickDirectory(deps.appSettings.value.defaultInboxDirectory || undefined);
      if (!selected) return;
      deps.appSettings.value.defaultInboxDirectory = normalizePathInput(selected);
      deps.pushToast({ level: 'success', title: '默认收件目录已设置', message: deps.appSettings.value.defaultInboxDirectory });
    } catch (error) {
      deps.pushToast({ level: 'error', title: '无法选择默认收件目录', message: String(error) });
    }
  }

  async function useSystemDownloadsAsDefault(): Promise<void> {
    try {
      const directory = await getDownloadDirectory();
      deps.appSettings.value.defaultInboxDirectory = normalizePathInput(directory);
      deps.pushToast({ level: 'success', title: '默认收件目录已设为系统下载目录', message: deps.appSettings.value.defaultInboxDirectory });
    } catch (error) {
      deps.pushToast({ level: 'error', title: '无法获取系统下载目录', message: String(error) });
    }
  }

  function applyInboxDefaultsToChannels(): void {
    let updated = 0;
    for (const channel of deps.channels.value) {
      if (!channel.inboxDirectory.trim() && deps.appSettings.value.defaultInboxDirectory) {
        channel.inboxDirectory = deps.appSettings.value.defaultInboxDirectory;
        updated += 1;
      }
      channel.inboxMatchMode = deps.appSettings.value.defaultInboxMatchMode;
      channel.inboxRecursive = deps.appSettings.value.defaultInboxRecursive;
      channel.inboxPreferHighestVersion = deps.appSettings.value.defaultPreferHighestVersion;
      channel.inboxIncludePrerelease = deps.appSettings.value.defaultIncludePrerelease;
    }
    deps.pushToast({ level: 'info', title: '关键词收件默认值已应用', message: `${deps.channels.value.length} 个通道 · ${updated} 个目录已补齐` });
  }

  async function browseInboxDirectory(channelId: string): Promise<void> {
    const channel = deps.channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    try {
      const selected = await pickDirectory(channel.inboxDirectory || deps.appSettings.value.defaultInboxDirectory);
      if (!selected) return;
      channel.inboxDirectory = normalizePathInput(selected);
      channel.inboxEnabled = true;
      deps.pushToast({ level: 'success', title: '关键词收件目录已设置', message: channel.inboxDirectory });
    } catch (error) {
      deps.pushToast({ level: 'error', title: '无法选择收件目录', message: String(error) });
    }
  }

  async function useSystemDownloadsForChannel(channelId: string): Promise<void> {
    const channel = deps.channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    try {
      const directory = await getDownloadDirectory();
      channel.inboxDirectory = normalizePathInput(directory);
      channel.inboxEnabled = true;
      if (!deps.appSettings.value.defaultInboxDirectory) deps.appSettings.value.defaultInboxDirectory = channel.inboxDirectory;
      deps.pushToast({ level: 'success', title: '已使用系统下载目录', message: channel.inboxDirectory });
    } catch (error) {
      deps.pushToast({ level: 'error', title: '无法获取系统下载目录', message: String(error) });
    }
  }

  function latestInboxResult(channelId: string): (ArchiveDirectoryScanResult & { scannedAt: string }) | undefined {
    return inboxScanResults.value[channelId];
  }

  async function openInboxDirectory(channelId: string): Promise<void> {
    const channel = deps.channels.value.find((item) => item.id === channelId);
    if (!channel?.inboxDirectory.trim()) {
      deps.pushToast({ level: 'warn', title: '还没有可打开的收件目录' });
      return;
    }
    try {
      await openOutput(channel.inboxDirectory);
    } catch (error) {
      deps.pushToast({ level: 'error', title: '无法打开收件目录', message: String(error) });
    }
  }

  function clearInboxScanResult(channelId: string): void {
    if (!(channelId in inboxScanResults.value)) return;
    const next = { ...inboxScanResults.value };
    delete next[channelId];
    inboxScanResults.value = next;
  }

  async function scanChannelInbox(
    channelId: string,
    silent = false,
    options: ScanChannelInboxOptions = {},
  ): Promise<ArchiveDirectoryScanResult | null> {
    const channel = deps.channels.value.find((item) => item.id === channelId);
    if (!channel) return null;
    const keywords = parseInboxKeywords(channel.inboxKeywords);
    if (!channel.inboxDirectory.trim()) {
      if (!silent) deps.pushToast({ level: 'warn', title: '请先选择下载或收件目录', message: channel.name });
      return null;
    }
    if (!keywords.length) {
      if (!silent) deps.pushToast({ level: 'warn', title: '请填写通道关键词', message: '多个关键词可用逗号、分号或换行分隔。' });
      return null;
    }
    if (inboxScanningIds.value.includes(channelId)) return null;
    inboxScanningIds.value.push(channelId);
    try {
      const result = await scanArchiveDirectory({
        directory: channel.inboxDirectory,
        keywords,
        matchMode: channel.inboxMatchMode,
        recursive: channel.inboxRecursive,
        preferHighestVersion: channel.inboxPreferHighestVersion,
        includePrerelease: channel.inboxIncludePrerelease,
        maxCandidates: deps.appSettings.value.keywordScanMaxCandidates,
      });
      inboxScanResults.value[channelId] = { ...result, scannedAt: new Date().toISOString() };
      const selectedPath = result.selectedPath;
      if (!selectedPath) {
        deps.addLog({ level: 'info', channelName: channel.name, message: `关键词扫描完成：${result.selectionReason}` });
        if (!silent) deps.pushToast({ level: 'info', title: '没有找到匹配压缩包', message: `${channel.name} · 扫描 ${result.scannedFiles} 个文件` });
        return result;
      }

      channel.inboxEnabled = true;

      const shouldImportSelected = deps.appSettings.value.keywordScanAutoAdd || options.forceImportSelected === true;
      if (shouldImportSelected) {
        const activeStatuses = new Set(['queued', 'processing', 'paused']);
        const candidatePaths = new Set(result.candidates.map((candidate) => candidate.path));
        channel.files = channel.files.filter((file) => !candidatePaths.has(file.path) || activeStatuses.has(file.status));
        if (deps.appSettings.value.keywordScanReplaceQueue) {
          channel.files = channel.files.filter((file) => ['processing', 'paused'].includes(file.status));
        }
        await deps.addPathsToChannel(channel.id, [selectedPath], { allowAutoStart: options.suppressImportedAutoStart !== true });
        const selected = channel.files.find((file) => file.path === selectedPath);
        if (selected) selected.message = channel.inboxPreferHighestVersion ? '关键词匹配 · 已选择最高版本' : '关键词匹配 · 已选择最近文件';
        deps.addLog({ level: 'success', channelName: channel.name, fileName: result.selectedName, message: result.selectionReason });
        if (!silent) {
          deps.pushToast({
            level: 'success',
            title: options.forceImportSelected ? '已找到最新版' : '已加入关键词匹配结果',
            message: `${channel.name} · ${result.selectedName} · 共 ${result.matchedFiles} 个候选`,
            timeoutMs: 6500,
          });
        }
      } else {
        deps.addLog({ level: 'info', channelName: channel.name, fileName: result.selectedName, message: `扫描预览：${result.selectionReason}` });
        if (!silent) {
          deps.pushToast({
            level: 'info',
            title: '关键词扫描预览完成',
            message: `${channel.name} · 已推荐 ${result.selectedName}，请在候选列表中确认加入。`,
            timeoutMs: 6500,
          });
        }
      }
      return result;
    } catch (error) {
      const message = String(error);
      deps.addLog({ level: 'error', channelName: channel.name, message: `关键词扫描失败：${message}` });
      if (!silent) deps.pushToast({ level: 'error', title: '关键词扫描失败', message });
      return null;
    } finally {
      inboxScanningIds.value = inboxScanningIds.value.filter((id) => id !== channelId);
    }
  }

  async function importInboxCandidate(channelId: string, path: string): Promise<void> {
    if (path) await deps.addPathsToChannel(channelId, [path]);
  }

  async function scanAllKeywordChannels(silent = false): Promise<void> {
    const configured = deps.channels.value.filter((channel) =>
      channel.inboxEnabled && channel.inboxDirectory.trim() && parseInboxKeywords(channel.inboxKeywords).length > 0,
    );
    if (!configured.length) {
      if (!silent) deps.pushToast({ level: 'info', title: '没有已启用的关键词通道', message: '在通道设置中启用“关键词收件”。' });
      return;
    }
    let matched = 0;
    for (const channel of configured) {
      const result = await scanChannelInbox(channel.id, true);
      if (result?.selectedPath) matched += 1;
    }
    if (!silent) deps.pushToast({ level: matched ? 'success' : 'info', title: '全部关键词通道扫描完成', message: `${configured.length} 个通道 · ${matched} 个已匹配` });
  }

  return {
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
  };
}
