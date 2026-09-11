import type { Ref } from 'vue';
import { DEFAULT_APP_SETTINGS } from '../config/appearance';
import { APP_VERSION } from '../config/version';
import {
  PRESET_KEY,
  defaultChannel,
  normalizeChannel,
  normalizeConfigurationBundle,
  normalizePreset,
  toPersistedChannel,
} from '../domain/state';
import { writeJson } from '../services/persistence';
import {
  cancelJob,
  chooseConfigurationFile,
  chooseConfigurationSavePath,
  chooseTemplateFile,
  chooseTemplateSavePath,
  readTextFile,
  writeTextFile,
} from '../services/tauri';
import type {
  AppSettings,
  Channel,
  ChannelPreset,
  ConfigurationBundle,
  LogEntry,
  ToastMessage,
} from '../types';

type AddLog = (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
type PushToast = (toast: Omit<ToastMessage, 'id'>) => void;

interface ConfigurationDependencies {
  channels: Ref<Channel[]>;
  appSettings: Ref<AppSettings>;
  maxConcurrency: Ref<number>;
  recentDestinations: Ref<string[]>;
  presets: Ref<ChannelPreset[]>;
  processingFiles: Readonly<Ref<number>>;
  addRecentDestination: (path: string) => void;
  addLog: AddLog;
  pushToast: PushToast;
  recordHistory?: (label: string) => void;
  noteHistory?: (label: string) => void;
}

export function createChannelConfigurationActions(deps: ConfigurationDependencies) {
  function savePreset(channelId: string): void {
    const channel = deps.channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    const preset: ChannelPreset = {
      name: channel.name,
      destination: channel.destination,
      useArchiveDirectory: channel.useArchiveDirectory,
      createArchiveSubfolder: channel.createArchiveSubfolder,
      deduplicateArchiveRoot: channel.deduplicateArchiveRoot,
      collisionPolicy: channel.collisionPolicy,
      depthMode: channel.depthMode,
      depth: channel.depth,
      openAfter: channel.openAfter,
      fileSort: channel.fileSort,
      skipJunkFiles: channel.skipJunkFiles,
      keepEmptyDirectories: channel.keepEmptyDirectories,
      category: channel.category,
      categoryColor: channel.categoryColor,
      note: channel.note,
      inboxDirectory: channel.inboxDirectory,
      inboxKeywords: channel.inboxKeywords,
      inboxMatchMode: channel.inboxMatchMode,
      inboxRecursive: channel.inboxRecursive,
      inboxPreferHighestVersion: channel.inboxPreferHighestVersion,
      inboxIncludePrerelease: channel.inboxIncludePrerelease,
      inboxEnabled: channel.inboxEnabled,
      autoStartEnabled: channel.autoStartEnabled,
      autoLaunchClaudeAfterExtract: channel.autoLaunchClaudeAfterExtract,
    };
    deps.recordHistory?.(`保存预设：${preset.name}`);
    const index = deps.presets.value.findIndex((item) => item.name === preset.name);
    if (index >= 0) deps.presets.value[index] = preset;
    else deps.presets.value.push(preset);
    writeJson(PRESET_KEY, deps.presets.value);
    deps.addLog({ level: 'success', channelName: channel.name, message: '通道配置已保存为预设。' });
    deps.pushToast({ level: 'success', title: '预设已保存', message: preset.name });
  }

  function applyPreset(channelId: string, presetName: string): void {
    const channel = deps.channels.value.find((item) => item.id === channelId);
    const preset = deps.presets.value.find((item) => item.name === presetName);
    if (!channel || !preset) return;
    deps.recordHistory?.(`应用预设：${preset.name}`);
    Object.assign(channel, {
      destination: preset.destination,
      useArchiveDirectory: preset.useArchiveDirectory,
      createArchiveSubfolder: preset.createArchiveSubfolder,
      deduplicateArchiveRoot: preset.deduplicateArchiveRoot,
      collisionPolicy: preset.collisionPolicy,
      depthMode: preset.depthMode,
      depth: preset.depth,
      openAfter: preset.openAfter,
      fileSort: preset.fileSort,
      skipJunkFiles: preset.skipJunkFiles,
      keepEmptyDirectories: preset.keepEmptyDirectories,
      category: preset.category,
      categoryColor: preset.categoryColor,
      note: preset.note,
      inboxDirectory: preset.inboxDirectory,
      inboxKeywords: preset.inboxKeywords,
      inboxMatchMode: preset.inboxMatchMode,
      inboxRecursive: preset.inboxRecursive,
      inboxPreferHighestVersion: preset.inboxPreferHighestVersion,
      inboxIncludePrerelease: preset.inboxIncludePrerelease,
      inboxEnabled: preset.inboxEnabled,
      autoStartEnabled: preset.autoStartEnabled,
      autoLaunchClaudeAfterExtract: preset.autoLaunchClaudeAfterExtract,
    });
    if (channel.depthMode === 'skipOuter' && deps.appSettings.value.autoDirectForSkipOuter) {
      channel.createArchiveSubfolder = false;
    }
    if (preset.destination) deps.addRecentDestination(preset.destination);
    deps.pushToast({ level: 'success', title: '已应用通道预设', message: preset.name });
  }

  function deletePreset(presetName: string): boolean {
    const exists = deps.presets.value.some((item) => item.name === presetName);
    if (!exists) return false;
    if (!window.confirm(`确定删除已保存的通道预设“${presetName}”吗？`)) return false;
    deps.recordHistory?.(`删除预设：${presetName}`);
    deps.presets.value = deps.presets.value.filter((item) => item.name !== presetName);
    writeJson(PRESET_KEY, deps.presets.value);
    deps.addLog({ level: 'info', message: `已删除通道预设：${presetName}` });
    deps.pushToast({ level: 'info', title: '预设已删除', message: presetName });
    return true;
  }

  function renamePreset(presetName: string, nextName: string): boolean {
    const preset = deps.presets.value.find((item) => item.name === presetName);
    const normalized = nextName.trim().slice(0, 80);
    if (!preset || !normalized || normalized === presetName) return false;
    if (deps.presets.value.some((item) => item.name === normalized)) {
      deps.pushToast({ level: 'warn', title: '预设名称已存在', message: normalized });
      return false;
    }
    deps.recordHistory?.(`重命名预设：${presetName}`);
    preset.name = normalized;
    writeJson(PRESET_KEY, deps.presets.value);
    deps.pushToast({ level: 'success', title: '预设已重命名', message: normalized });
    return true;
  }

  function duplicatePreset(presetName: string): string | null {
    const preset = deps.presets.value.find((item) => item.name === presetName);
    if (!preset) return null;
    deps.recordHistory?.(`复制预设：${presetName}`);
    let nextName = `${presetName} 副本`;
    let suffix = 2;
    while (deps.presets.value.some((item) => item.name === nextName)) nextName = `${presetName} 副本 ${suffix++}`;
    deps.presets.value.push({ ...preset, name: nextName });
    writeJson(PRESET_KEY, deps.presets.value);
    deps.pushToast({ level: 'success', title: '预设已复制', message: nextName });
    return nextName;
  }

  function movePreset(presetName: string, direction: -1 | 1): boolean {
    const index = deps.presets.value.findIndex((item) => item.name === presetName);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= deps.presets.value.length) return false;
    deps.recordHistory?.(`调整预设顺序：${presetName}`);
    const [preset] = deps.presets.value.splice(index, 1);
    deps.presets.value.splice(target, 0, preset);
    writeJson(PRESET_KEY, deps.presets.value);
    return true;
  }

  function configurationBundle(): ConfigurationBundle {
    return {
      schemaVersion: 10,
      exportedAt: new Date().toISOString(),
      maxConcurrency: deps.maxConcurrency.value,
      appSettings: { ...deps.appSettings.value },
      channels: deps.channels.value.map(toPersistedChannel),
      presets: deps.presets.value.map((preset) => ({ ...preset })),
      recentDestinations: [...deps.recentDestinations.value],
    };
  }

  async function exportTemplates(): Promise<void> {
    try {
      const path = await chooseTemplateSavePath();
      if (!path) return;
      const bundle = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        appVersion: APP_VERSION,
        presets: deps.presets.value.map((preset) => ({ ...preset })),
      };
      await writeTextFile(path, JSON.stringify(bundle, null, 2));
      deps.pushToast({ level: 'success', title: '通道模板已导出', message: `${deps.presets.value.length} 个模板` });
    } catch (error) {
      deps.pushToast({ level: 'error', title: '模板导出失败', message: String(error) });
    }
  }

  async function importTemplates(): Promise<void> {
    try {
      const path = await chooseTemplateFile();
      if (!path) return;
      const raw = JSON.parse(await readTextFile(path)) as { presets?: Partial<ChannelPreset>[] } | Partial<ChannelPreset>[];
      const source = Array.isArray(raw) ? raw : raw.presets;
      if (!Array.isArray(source)) throw new Error('模板文件中没有 presets 数组');
      const imported = source.map(normalizePreset).filter((item): item is ChannelPreset => Boolean(item));
      for (const preset of imported) {
        const index = deps.presets.value.findIndex((item) => item.name === preset.name);
        if (index >= 0) deps.presets.value[index] = preset;
        else deps.presets.value.push(preset);
      }
      writeJson(PRESET_KEY, deps.presets.value);
      deps.pushToast({ level: 'success', title: '通道模板已导入', message: `${imported.length} 个模板` });
    } catch (error) {
      deps.pushToast({ level: 'error', title: '模板导入失败', message: String(error) });
    }
  }

  async function exportConfiguration(): Promise<void> {
    try {
      const path = await chooseConfigurationSavePath();
      if (!path) return;
      await writeTextFile(path, JSON.stringify(configurationBundle(), null, 2));
      deps.pushToast({ level: 'success', title: '配置已导出', message: path });
      deps.addLog({ level: 'success', message: `配置已导出到 ${path}` });
    } catch (error) {
      deps.pushToast({ level: 'error', title: '配置导出失败', message: String(error) });
    }
  }

  async function importConfiguration(): Promise<void> {
    if (deps.processingFiles.value > 0) {
      deps.pushToast({ level: 'warn', title: '有任务正在运行', message: '请先取消或等待任务完成，再导入配置。' });
      return;
    }
    try {
      const path = await chooseConfigurationFile();
      if (!path) return;
      const content = await readTextFile(path);
      const bundle = normalizeConfigurationBundle(JSON.parse(content));
      deps.appSettings.value = bundle.appSettings;
      deps.maxConcurrency.value = bundle.maxConcurrency;
      deps.recentDestinations.value = bundle.recentDestinations;
      deps.presets.value = bundle.presets;
      deps.channels.value = bundle.channels.length
        ? bundle.channels.map((channel, index) => normalizeChannel(channel, index + 1, bundle.appSettings))
        : [defaultChannel(1, bundle.appSettings)];
      writeJson(PRESET_KEY, deps.presets.value);
      deps.pushToast({ level: 'success', title: '配置已导入', message: `${deps.channels.value.length} 个通道 · ${deps.presets.value.length} 个预设` });
      deps.addLog({ level: 'success', message: `已从 ${path} 导入配置。` });
    } catch (error) {
      deps.pushToast({ level: 'error', title: '配置导入失败', message: String(error) });
    }
  }

  function resetAppSettings(): void {
    deps.appSettings.value = { ...DEFAULT_APP_SETTINGS };
    deps.maxConcurrency.value = 3;
    deps.addLog({ level: 'info', message: '全局设置已恢复默认。' });
    deps.pushToast({ level: 'info', title: '全局设置已恢复默认' });
  }

  function resetWorkspace(): void {
    deps.recordHistory?.('重置工作区');
    deps.channels.value.forEach((channel) => {
      channel.files
        .filter((file) => ['queued', 'processing', 'paused'].includes(file.status))
        .forEach((file) => void cancelJob(file.id));
    });
    deps.channels.value = [defaultChannel(1, deps.appSettings.value)];
    deps.addLog({ level: 'warn', message: '工作区已重置。' });
    deps.pushToast({ level: 'warn', title: '工作区已重置' });
  }

  return {
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
  };
}
