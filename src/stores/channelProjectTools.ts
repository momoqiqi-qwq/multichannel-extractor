import type { Ref } from 'vue';
import { checkClaudeCli, installClaudeDat, launchClaudeFromDat, openOutput, pickDirectory } from '../services/tauri';
import { normalizePathInput, parentDirectory } from '../utils/path';
import type { AppSettings, Channel, ClaudeCliStatus, LogEntry, ToastMessage } from '../types';

type AddLog = (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
type PushToast = (toast: Omit<ToastMessage, 'id'>) => void;


interface LaunchClaudeOptions {
  skipConfirmation?: boolean;
  automatic?: boolean;
  channelName?: string;
  fileName?: string;
}

interface ProjectToolsDependencies {
  channels: Ref<Channel[]>;
  appSettings: Ref<AppSettings>;
  addRecentDestination: (path: string) => void;
  addLog: AddLog;
  pushToast: PushToast;
}

export function createChannelProjectTools(deps: ProjectToolsDependencies) {
  const recentAutomaticLaunches = new Map<string, number>();
  const AUTOMATIC_LAUNCH_DEDUPLICATION_MS = 8000;

  function latestExtractedDirectory(channel: Channel): string {
    return [...channel.files]
      .reverse()
      .find((file) => file.status === 'success' && file.outputPath && !file.outputDeleted)
      ?.outputPath?.trim() || '';
  }

  function configuredClaudeDirectory(channel: Channel): string {
    if (!channel.useArchiveDirectory) return normalizePathInput(channel.destination);
    return [...channel.files]
      .reverse()
      .map((file) => parentDirectory(file.path))
      .find(Boolean) || '';
  }

  function channelClaudeDirectory(channelId: string): string {
    const channel = deps.channels.value.find((item) => item.id === channelId);
    if (!channel) return '';
    return configuredClaudeDirectory(channel) || latestExtractedDirectory(channel);
  }

  function rememberClaudeDirectory(directory: string): void {
    deps.appSettings.value.claudeToolsDirectory = directory;
    deps.addRecentDestination(directory);
  }

  async function chooseClaudeDirectory(initialDirectory = ''): Promise<string> {
    const initial = normalizePathInput(initialDirectory);
    try {
      const selected = await pickDirectory(initial || undefined);
      const normalized = normalizePathInput(selected || '');
      if (normalized) rememberClaudeDirectory(normalized);
      return normalized;
    } catch (error) {
      deps.pushToast({ level: 'error', title: '无法选择 Claude 工作目录', message: String(error) });
      return '';
    }
  }

  async function resolveClaudeDirectoryForChannel(channel: Channel): Promise<string> {
    const configuredDirectory = configuredClaudeDirectory(channel);
    if (configuredDirectory) return configuredDirectory;

    const extractedDirectory = latestExtractedDirectory(channel);
    if (extractedDirectory) return extractedDirectory;

    deps.pushToast({
      level: 'warn',
      title: '尚未配置可用的解压目录',
      message: channel.useArchiveDirectory
        ? '当前通道选择了“跟随压缩包”，请先加入压缩包，项目工具会直接使用压缩包所在目录。'
        : '请先在通道的“指定目录”中填写或选择解压目录，项目工具不会再额外弹出目录选择器。',
      timeoutMs: 7000,
    });
    return '';
  }

  async function generateClaudeDatAt(directory: string): Promise<void> {
    const normalized = normalizePathInput(directory);
    if (!normalized) {
      deps.pushToast({ level: 'warn', title: '请先选择目标文件夹' });
      return;
    }
    try {
      const path = await installClaudeDat(normalized, deps.appSettings.value.overwriteClaudeDat);
      rememberClaudeDirectory(normalized);
      deps.pushToast({ level: 'success', title: 'Claude DAT 已就绪', message: path });
      deps.addLog({ level: 'success', message: `Claude 项目 DAT 已就绪：${path}` });
      if (deps.appSettings.value.openFolderAfterDatInstall) await openOutput(normalized);
    } catch (error) {
      deps.pushToast({ level: 'error', title: '生成 Claude DAT 失败', message: String(error) });
    }
  }

  async function checkClaudeAvailability(showToast = true): Promise<ClaudeCliStatus | null> {
    try {
      const status = await checkClaudeCli();
      if (showToast) {
        deps.pushToast({
          level: status.available ? 'success' : 'error',
          title: status.available ? 'Claude CLI 可用' : '未找到 Claude CLI',
          message: status.message,
          timeoutMs: 7000,
        });
      }
      return status;
    } catch (error) {
      if (showToast) deps.pushToast({ level: 'error', title: 'Claude CLI 检测失败', message: String(error) });
      return null;
    }
  }

  async function launchClaudeAt(directory: string, options: LaunchClaudeOptions = {}): Promise<boolean> {
    const normalized = normalizePathInput(directory);
    if (!normalized) {
      deps.pushToast({ level: 'warn', title: '请先选择 Claude 工作目录' });
      return false;
    }
    if (deps.appSettings.value.confirmBeforeClaudeBypass && !options.skipConfirmation) {
      const accepted = window.confirm(`将在以下目录启动 Claude：\n${normalized}\n\n命令：claude --dangerously-skip-permissions\n该模式会跳过权限确认，请仅在可信目录中使用。确定继续吗？`);
      if (!accepted) return false;
    }
    try {
      if (deps.appSettings.value.claudeVerifyBeforeLaunch) {
        const status = await checkClaudeAvailability(false);
        if (!status?.available) throw new Error(status?.message || '未检测到可用的 Claude CLI');
      }
      if (deps.appSettings.value.claudeAutoInstallDat) {
        await installClaudeDat(normalized, deps.appSettings.value.overwriteClaudeDat);
      }
      const result = await launchClaudeFromDat(normalized);
      if (!options.automatic) rememberClaudeDirectory(result.workingDirectory);
      deps.pushToast({
        level: 'warn',
        title: options.automatic ? '解压完成，已自动启动 Claude' : 'Claude 已通过项目 DAT 启动',
        message: `${result.workingDirectory} · ${result.datPath} · PID ${result.processId}`,
        timeoutMs: 8000,
      });
      deps.addLog({
        level: 'warn',
        channelName: options.channelName,
        fileName: options.fileName,
        message: `${options.automatic ? '解压完成后自动' : '手动'}读取 ${result.datPath}，通过 ${result.launcher} 在 ${result.workingDirectory} 启动 ${result.command}（PID ${result.processId}）。`,
      });
      return true;
    } catch (error) {
      deps.pushToast({
        level: 'error',
        title: options.automatic ? '解压完成，但自动启动 Claude 失败' : '启动 Claude 失败',
        message: `${String(error)}。请在“总设置 → 项目工具”中运行 Claude CLI 检测。`,
        timeoutMs: 9000,
      });
      return false;
    }
  }

  async function launchClaudeAfterExtraction(
    directory: string,
    channelName: string,
    fileName: string,
  ): Promise<boolean> {
    const normalized = normalizePathInput(directory);
    if (!normalized) return false;

    const key = normalized.toLocaleLowerCase();
    const now = Date.now();
    const lastStartedAt = recentAutomaticLaunches.get(key) || 0;
    if (now - lastStartedAt < AUTOMATIC_LAUNCH_DEDUPLICATION_MS) {
      deps.addLog({
        level: 'info',
        channelName,
        fileName,
        message: `同一目录刚刚已自动启动 Claude，本次跳过重复窗口：${normalized}`,
      });
      return false;
    }

    recentAutomaticLaunches.set(key, now);
    const launched = await launchClaudeAt(normalized, {
      skipConfirmation: true,
      automatic: true,
      channelName,
      fileName,
    });
    if (!launched) recentAutomaticLaunches.delete(key);
    window.setTimeout(() => {
      if (recentAutomaticLaunches.get(key) === now) recentAutomaticLaunches.delete(key);
    }, AUTOMATIC_LAUNCH_DEDUPLICATION_MS);
    return launched;
  }

  async function browseClaudeToolsDirectory(): Promise<string> {
    return chooseClaudeDirectory(deps.appSettings.value.claudeToolsDirectory);
  }

  async function generateClaudeDatForChannel(channelId: string): Promise<void> {
    const channel = deps.channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    const directory = await resolveClaudeDirectoryForChannel(channel);
    if (!directory) return;
    await generateClaudeDatAt(directory);
  }

  async function launchClaudeForChannel(channelId: string): Promise<void> {
    const channel = deps.channels.value.find((item) => item.id === channelId);
    if (!channel) return;
    const directory = await resolveClaudeDirectoryForChannel(channel);
    if (!directory) return;
    await launchClaudeAt(directory);
  }

  async function launchClaudeForFile(fileId: string): Promise<void> {
    for (const channel of deps.channels.value) {
      const file = channel.files.find((item) => item.id === fileId);
      if (!file) continue;
      const directory = file.status === 'success' && file.outputPath && !file.outputDeleted
        ? file.outputPath.trim()
        : '';
      if (!directory) {
        deps.pushToast({ level: 'warn', title: '这个文件还没有可用的解压目录', message: file.name });
        return;
      }
      await launchClaudeAt(directory);
      return;
    }
  }

  return {
    latestExtractedDirectory,
    configuredClaudeDirectory,
    channelClaudeDirectory,
    generateClaudeDatAt,
    checkClaudeAvailability,
    launchClaudeAt,
    launchClaudeAfterExtraction,
    browseClaudeToolsDirectory,
    generateClaudeDatForChannel,
    launchClaudeForChannel,
    launchClaudeForFile,
  };
}
