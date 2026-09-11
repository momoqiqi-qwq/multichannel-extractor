import type { Ref } from 'vue';
import type { AppSettings, Channel, ChannelPreset, LogEntry, ToastMessage, ChannelAutomationProfile } from '../types';
import type { useWorkspaceHistoryStore } from './workspaceHistory';

type AddLog = (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
type PushToast = (toast: Omit<ToastMessage, 'id'>) => void;
type HistoryStore = ReturnType<typeof useWorkspaceHistoryStore>;

interface ChannelWorkspaceActionDependencies {
  channels: Ref<Channel[]>;
  appSettings: Ref<AppSettings>;
  processingFiles: Readonly<Ref<number>>;
  presets: Ref<ChannelPreset[]>;
  history: HistoryStore;
  recordWorkspaceAction: (label: string) => void;
  addLog: AddLog;
  pushToast: PushToast;
}

export function createChannelWorkspaceActions(deps: ChannelWorkspaceActionDependencies) {
  function applyChannelAutomationProfile(channelId: string, profile: ChannelAutomationProfile): void {
    const channel = deps.channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    deps.recordWorkspaceAction(`切换自动化方案：${channel.name}`);
    if (profile === 'manual') {
      channel.autoStartEnabled = false;
      channel.inboxEnabled = false;
    } else if (profile === 'import-auto') {
      channel.autoStartEnabled = true;
      channel.inboxEnabled = false;
    } else if (profile === 'latest-manual') {
      channel.autoStartEnabled = false;
      channel.inboxEnabled = true;
    } else {
      channel.autoStartEnabled = true;
      channel.inboxEnabled = true;
      deps.appSettings.value.scanLatestOnEmptyStart = true;
    }
    const labels: Record<ChannelAutomationProfile, string> = {
      manual: '纯手动',
      'import-auto': '导入即开始',
      'latest-manual': '最新版按需',
      'latest-auto': '最新版自动',
    };
    deps.pushToast({ level: 'success', title: '自动化方案已应用', message: `${channel.name} · ${labels[profile]}` });
  }

  function undoLastAction(): void {
    if (deps.processingFiles.value > 0) {
      deps.pushToast({ level: 'warn', title: '任务运行中不能撤销', message: '等待当前任务结束或取消任务后再撤销工作区结构。' });
      return;
    }
    const restored = deps.history.undo();
    if (!restored) {
      deps.pushToast({ level: 'info', title: '没有可撤销操作' });
      return;
    }
    deps.channels.value = restored.channels;
    deps.presets.value = restored.presets;
    deps.addLog({ level: 'info', message: `已撤销：${restored.label}` });
    deps.pushToast({ level: 'success', title: '已撤销上一步', message: restored.label });
  }

  return { applyChannelAutomationProfile, undoLastAction };
}
