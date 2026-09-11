import type { Ref } from 'vue';
import { deleteExtraction, openOutput } from '../services/tauri';
import { findArchiveFile } from './channelSelectors';
import type { AppSettings, Channel, DeleteExtractionResult, LogEntry, ToastMessage } from '../types';

type AddLog = (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
type PushToast = (toast: Omit<ToastMessage, 'id'>) => void;

interface OutputDependencies {
  channels: Ref<Channel[]>;
  appSettings: Ref<AppSettings>;
  addLog: AddLog;
  pushToast: PushToast;
  markTaskOutputDeleted: (manifestPath: string, result: DeleteExtractionResult) => void;
}

export function createChannelOutputActions(deps: OutputDependencies) {
  async function openFileOutput(fileId: string): Promise<void> {
    const found = findArchiveFile(deps.channels.value, fileId);
    const output = found?.file.outputPath;
    if (!found || !output) return;
    try {
      await openOutput(output);
    } catch (error) {
      deps.addLog({ level: 'error', channelName: found.channel.name, fileName: found.file.name, message: `打开输出目录失败：${String(error)}` });
      deps.pushToast({ level: 'error', title: '无法打开输出目录', message: String(error) });
    }
  }

  async function openChannelOutput(channelId: string): Promise<void> {
    const channel = deps.channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    const output = channel.files.find((file) => file.outputPath)?.outputPath || channel.destination;
    if (!output) return;
    try {
      await openOutput(output);
    } catch (error) {
      deps.addLog({ level: 'error', channelName: channel.name, message: `打开输出目录失败：${String(error)}` });
      deps.pushToast({ level: 'error', title: '无法打开输出目录', message: String(error) });
    }
  }

  async function deleteChannelOutputs(channelId: string): Promise<void> {
    const channel = deps.channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    const targets = channel.files.filter((file) => file.manifestPath && !file.outputDeleted);
    if (!targets.length) {
      deps.pushToast({ level: 'warn', title: '没有可安全删除的解压结果', message: '旧版本任务或清单已删除的任务不会被直接清理。' });
      return;
    }
    const replaced = targets.reduce((sum, file) => sum + (file.replacedFiles || 0), 0);
    const deleteReplaced = deps.appSettings.value.deleteReplacedOutputs;
    if (deps.appSettings.value.confirmBeforeDeleteOutput) {
      const detail = replaced && !deleteReplaced
        ? `安全模式会保留 ${replaced} 个曾被替换的文件。`
        : replaced
          ? `包含 ${replaced} 个曾替换旧内容的文件，这些文件也会被删除。`
          : '只删除任务清单记录的文件与本次创建的空目录。';
      if (!window.confirm(`删除“${channel.name}”中 ${targets.length} 个任务的解压结果吗？\n${detail}`)) return;
    }
    let deleted = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const file of targets) {
      try {
        const manifestPath = file.manifestPath!;
        const result = await deleteExtraction(manifestPath, deleteReplaced);
        deps.markTaskOutputDeleted(manifestPath, result);
        deleted += result.deletedFiles;
        skipped += result.skippedReplacedFiles;
        file.outputDeleted = true;
        file.manifestPath = undefined;
        file.message = '解压结果已删除';
      } catch (error) {
        errors.push(`${file.name}: ${String(error)}`);
      }
    }
    if (errors.length) {
      deps.pushToast({ level: 'error', title: `${errors.length} 个任务删除失败`, message: errors[0], timeoutMs: 8000 });
    } else {
      deps.pushToast({ level: 'success', title: '通道解压结果已删除', message: `删除 ${deleted} 个文件${skipped ? `，保留 ${skipped} 个替换文件` : ''}` });
    }
    deps.addLog({
      level: errors.length ? 'warn' : 'success',
      channelName: channel.name,
      message: `批量删除解压结果：删除 ${deleted} 个文件，保留 ${skipped} 个替换文件，失败 ${errors.length} 个任务。`,
    });
  }

  async function deleteFileOutput(fileId: string): Promise<void> {
    const found = findArchiveFile(deps.channels.value, fileId);
    if (!found?.file.manifestPath) {
      deps.pushToast({ level: 'warn', title: '无法安全删除', message: '这个结果没有删除清单，可能来自旧版本或清单已被清理。' });
      return;
    }
    const replaced = found.file.replacedFiles || 0;
    const deleteReplaced = deps.appSettings.value.deleteReplacedOutputs;
    if (deps.appSettings.value.confirmBeforeDeleteOutput) {
      const detail = replaced && !deleteReplaced
        ? `将删除本次新增文件，并保留 ${replaced} 个曾被替换的文件。`
        : replaced
          ? `包含 ${replaced} 个曾替换旧内容的文件，这些文件也会被删除。`
          : '只删除本次任务清单中记录的文件和空目录。';
      if (!window.confirm(`删除“${found.file.name}”的解压结果吗？\n${detail}`)) return;
    }
    try {
      const manifestPath = found.file.manifestPath;
      const result = await deleteExtraction(manifestPath, deleteReplaced);
      deps.markTaskOutputDeleted(manifestPath, result);
      found.file.outputDeleted = true;
      found.file.manifestPath = undefined;
      found.file.message = result.skippedReplacedFiles
        ? `已删除新增文件；保留 ${result.skippedReplacedFiles} 个替换文件`
        : `已删除 ${result.deletedFiles} 个解压文件`;
      deps.addLog({ level: 'warn', channelName: found.channel.name, fileName: found.file.name, message: found.file.message });
      deps.pushToast({ level: 'success', title: '解压结果已删除', message: found.file.message });
    } catch (error) {
      deps.pushToast({ level: 'error', title: '删除解压结果失败', message: String(error) });
    }
  }

  return { openFileOutput, openChannelOutput, deleteChannelOutputs, deleteFileOutput };
}
