import type { Ref } from 'vue';
import { inspectFiles } from '../services/tauri';
import { parseChannelKeywords, scoreFileNameAgainstKeywords } from '../domain/channelRouting';
import type { AppSettings, Channel, LogEntry, ToastMessage } from '../types';

type AddLog = (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
type PushToast = (toast: Omit<ToastMessage, 'id'>) => void;

interface RoutingDependencies {
  channels: Ref<Channel[]>;
  appSettings: Ref<AppSettings>;
  addPathsToChannel: (channelId: string, paths: string[]) => Promise<void>;
  addLog: AddLog;
  pushToast: PushToast;
}

export function createChannelRoutingActions(deps: RoutingDependencies) {
  async function routePathsToChannels(paths: string[], source: 'drop' | 'startup' = 'drop'): Promise<void> {
    if (!paths.length) return;
    if (!deps.appSettings.value.autoRouteDroppedFiles) {
      deps.pushToast({
        level: 'info',
        title: '自动通道路由已关闭',
        message: source === 'startup' ? '请在总设置中开启自动路由，或从应用内选择文件。' : '请把文件直接拖到目标通道。',
      });
      return;
    }

    try {
      const inspected = await inspectFiles(paths);
      const configured = deps.channels.value
        .map((channel, index) => ({
          channel,
          index,
          keywords: parseChannelKeywords(channel.inboxKeywords),
        }))
        .filter((item) => item.keywords.length > 0);

      if (!configured.length) {
        deps.pushToast({
          level: 'warn',
          title: '还没有可自动匹配的通道',
          message: '先把一个文件拖入目标通道，解压台会自动学习该通道的关键词。',
          timeoutMs: 7000,
        });
        return;
      }

      const assignments = new Map<string, string[]>();
      const unmatched: string[] = [];
      const ambiguous: string[] = [];

      for (const file of inspected) {
        if (!file.supported) {
          unmatched.push(file.name);
          continue;
        }
        const ranked = configured
          .map((entry) => ({
            ...entry,
            match: scoreFileNameAgainstKeywords(file.name, entry.keywords, entry.channel.inboxMatchMode),
          }))
          .filter((entry) => entry.match.matched)
          .sort((a, b) => b.match.score - a.match.score || a.index - b.index);

        if (!ranked.length) {
          unmatched.push(file.name);
          continue;
        }
        if (ranked.length > 1 && ranked[0].match.score === ranked[1].match.score) {
          ambiguous.push(file.name);
          continue;
        }

        const channelId = ranked[0].channel.id;
        const bucket = assignments.get(channelId) ?? [];
        bucket.push(file.path);
        assignments.set(channelId, bucket);
      }

      for (const [channelId, assignedPaths] of assignments) {
        await deps.addPathsToChannel(channelId, assignedPaths);
      }

      if (unmatched.length || ambiguous.length) {
        const details = [
          unmatched.length ? `${unmatched.length} 个未匹配` : '',
          ambiguous.length ? `${ambiguous.length} 个匹配到多个通道` : '',
        ].filter(Boolean).join(' · ');
        deps.pushToast({
          level: 'warn',
          title: '部分文件没有自动进入通道',
          message: `${details}。可直接拖到目标通道，或调整“通道关键词”。`,
          timeoutMs: 8000,
        });
      } else if (assignments.size > 0) {
        deps.addLog({
          level: 'success',
          message: `${source === 'startup' ? 'EXE 启动文件' : '工作区拖入文件'}已按关键词自动分配到 ${assignments.size} 个通道。`,
        });
      }
    } catch (error) {
      const message = String(error);
      deps.addLog({ level: 'error', message: `自动通道路由失败：${message}` });
      deps.pushToast({ level: 'error', title: '自动通道路由失败', message });
    }
  }

  return { routePathsToChannels };
}
