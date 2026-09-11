import type { Ref } from 'vue';
import { inspectFiles, pickArchiveFiles } from '../services/tauri';
import { extractArchiveKeywords } from '../domain/channelRouting';
import { createId } from '../domain/state';
import type { AppSettings, ArchiveFile, Channel, FileStatus, LogEntry, ToastMessage } from '../types';

type AddLog = (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
type PushToast = (toast: Omit<ToastMessage, 'id'>) => void;
type RunChannels = (
  selectedChannels: Channel[],
  statuses?: FileStatus[],
  automatic?: boolean,
  automaticContext?: string,
) => Promise<boolean>;

export interface AddPathsToChannelOptions {
  allowAutoStart?: boolean;
}

interface ImportDependencies {
  channels: Ref<Channel[]>;
  appSettings: Ref<AppSettings>;
  runChannels: RunChannels;
  addLog: AddLog;
  pushToast: PushToast;
}

export function createChannelImportActions(deps: ImportDependencies) {
  async function addPathsToChannel(channelId: string, paths: string[], options: AddPathsToChannelOptions = {}): Promise<void> {
    const channel = deps.channels.value.find((item) => item.id === channelId);
    if (!channel || !paths.length) return;
    try {
      const inspected = await inspectFiles(paths);
      const hadKeywordsBeforeImport = Boolean(channel.inboxKeywords.trim());
      let added = 0;
      let replaced = 0;
      let ignored = 0;
      let supportedAdded = 0;
      const autoStartFileIds: string[] = [];
      for (const item of inspected) {
        const existing = channel.files.find((file) => file.path === item.path);
        if (existing && deps.appSettings.value.duplicateImportPolicy === 'ignore') {
          ignored += 1;
          continue;
        }
        if (existing && deps.appSettings.value.duplicateImportPolicy === 'replace') {
          Object.assign(existing, item, {
            status: item.supported ? 'pending' : 'error',
            progress: 0,
            message: item.supported ? '待处理' : '不支持的格式',
            outputPath: undefined,
            priority: existing.priority || 'normal',
          });
          replaced += 1;
          supportedAdded += item.supported ? 1 : 0;
          if (item.supported) autoStartFileIds.push(existing.id);
          continue;
        }
        const file: ArchiveFile = {
          id: createId('job'),
          ...item,
          status: item.supported ? 'pending' : 'error',
          progress: 0,
          message: item.supported ? '待处理' : '不支持的格式',
          priority: 'normal',
        };
        channel.files.push(file);
        added += 1;
        supportedAdded += item.supported ? 1 : 0;
        if (item.supported) autoStartFileIds.push(file.id);
        deps.addLog({
          level: item.supported ? 'info' : 'warn',
          channelName: channel.name,
          fileName: item.name,
          message: item.supported ? '已加入文件队列。' : '文件格式不受支持。',
        });
      }

      if (deps.appSettings.value.autoLearnChannelKeywords && !hadKeywordsBeforeImport && supportedAdded > 0) {
        const sourceName = channel.files.find((file) => file.supported)?.name ?? inspected.find((item) => item.supported)?.name;
        const learnedKeywords = sourceName ? extractArchiveKeywords(sourceName) : [];
        if (learnedKeywords.length) {
          channel.inboxKeywords = learnedKeywords.join(', ');
          deps.addLog({
            level: 'success',
            channelName: channel.name,
            fileName: sourceName,
            message: `已自动提取通道关键词：${channel.inboxKeywords}`,
          });
          deps.pushToast({
            level: 'success',
            title: '已学习通道关键词',
            message: `${channel.name} · ${channel.inboxKeywords}`,
            timeoutMs: 5200,
          });
        }
      }

      if (!added && !replaced) {
        deps.addLog({ level: 'info', channelName: channel.name, message: '没有新增文件，重复项目已按设置忽略。' });
        deps.pushToast({ level: 'info', title: '没有新增文件', message: ignored ? `已忽略 ${ignored} 个重复文件。` : '所选文件可能已经在这个通道中。' });
        return;
      }
      const detail = [added ? `新增 ${added}` : '', replaced ? `更新 ${replaced}` : '', ignored ? `忽略 ${ignored}` : ''].filter(Boolean).join(' · ');
      deps.pushToast({ level: supportedAdded ? 'success' : 'warn', title: '文件队列已更新', message: `${channel.name} · ${detail}` });
      if (inspected.some((item) => !item.supported) && deps.appSettings.value.autoExpandOnError) channel.expanded = true;
      if (channel.autoStartEnabled && supportedAdded > 0 && options.allowAutoStart !== false) {
        if (!channel.useArchiveDirectory && !channel.destination) {
          channel.expanded = true;
          deps.pushToast({ level: 'warn', title: '自动开始已暂停', message: '请先为此通道选择指定解压目录。' });
        } else {
          const importedFiles = channel.files.filter((file) => autoStartFileIds.includes(file.id));
          const started = await deps.runChannels([{ ...channel, files: importedFiles }], ['pending'], true);
          if (started) deps.addLog({ level: 'info', channelName: channel.name, message: `通道自动开始已提交 ${importedFiles.length} 个新任务。` });
        }
      }
    } catch (error) {
      const message = String(error);
      deps.addLog({ level: 'error', channelName: channel.name, message: `读取文件信息失败：${message}` });
      deps.pushToast({ level: 'error', title: '读取文件失败', message });
    }
  }

  async function browseFiles(channelId: string): Promise<void> {
    const channel = deps.channels.value.find((item) => item.id === channelId);
    try {
      const paths = await pickArchiveFiles();
      await addPathsToChannel(channelId, paths);
    } catch (error) {
      const message = String(error);
      deps.addLog({ level: 'error', channelName: channel?.name, message: `打开文件选择器失败：${message}` });
      deps.pushToast({ level: 'error', title: '无法打开文件选择器', message: '请在 Tauri 桌面应用中重试，或直接拖入文件。' });
    }
  }

  return { addPathsToChannel, browseFiles };
}
