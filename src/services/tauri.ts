import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open, save } from '@tauri-apps/plugin-dialog';
import type {
  ArchiveDirectoryScanRequest,
  ArchiveDirectoryScanResult,
  BatchFinishedEvent,
  ClaudeCliStatus,
  ClaudeLaunchResult,
  InspectedFile,
  JobFinishedEvent,
  ProgressEvent,
  StartBatchPayload,
  DeleteExtractionResult,
  PreflightRequest,
  PreflightResult,
} from '../types';

const ARCHIVE_FILTERS = [
  {
    name: '压缩文件',
    extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'tbz2', 'xz', 'txz'],
  },
];

export async function pickArchiveFiles(): Promise<string[]> {
  const result = await open({
    multiple: true,
    directory: false,
    filters: ARCHIVE_FILTERS,
  });
  if (!result) return [];
  return Array.isArray(result) ? result : [result];
}

export async function pickDirectory(defaultPath?: string): Promise<string | null> {
  const options = {
    multiple: false,
    directory: true,
    defaultPath: defaultPath?.trim() || undefined,
  };
  try {
    const result = await open(options);
    return typeof result === 'string' ? result : null;
  } catch (error) {
    // An invalid or unavailable remembered path must not make the picker unusable.
    if (!options.defaultPath) throw error;
    const result = await open({ multiple: false, directory: true });
    return typeof result === 'string' ? result : null;
  }
}

export async function pickBackgroundImage(defaultPath?: string): Promise<string | null> {
  const options = {
    multiple: false,
    directory: false,
    defaultPath: defaultPath?.trim() || undefined,
    filters: [
      {
        name: '背景图片',
        extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'],
      },
    ],
  };
  try {
    const result = await open(options);
    return typeof result === 'string' ? result : null;
  } catch (error) {
    if (!options.defaultPath) throw error;
    const result = await open({ ...options, defaultPath: undefined });
    return typeof result === 'string' ? result : null;
  }
}

export async function chooseLogPath(): Promise<string | null> {
  const result = await save({
    defaultPath: `extractor-log-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON 日志', extensions: ['json'] }],
  });
  return result || null;
}


export async function chooseConfigurationSavePath(): Promise<string | null> {
  const result = await save({
    defaultPath: `extractor-config-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: '解压台配置', extensions: ['json'] }],
  });
  return result || null;
}

export async function chooseTemplateSavePath(): Promise<string | null> {
  const result = await save({
    defaultPath: `jieyatai-channel-templates-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: '通道模板', extensions: ['json'] }],
  });
  return result || null;
}

export async function chooseTemplateFile(): Promise<string | null> {
  const result = await open({
    multiple: false,
    directory: false,
    filters: [{ name: '通道模板', extensions: ['json'] }],
  });
  return typeof result === 'string' ? result : null;
}

export async function chooseConfigurationFile(): Promise<string | null> {
  const result = await open({
    multiple: false,
    directory: false,
    filters: [{ name: '解压台配置', extensions: ['json'] }],
  });
  return typeof result === 'string' ? result : null;
}

export function inspectFiles(paths: string[]): Promise<InspectedFile[]> {
  return invoke<InspectedFile[]>('inspect_files', { paths });
}

export function getStartupArchivePaths(): Promise<string[]> {
  return invoke<string[]>('startup_archive_paths');
}

export function scanArchiveDirectory(request: ArchiveDirectoryScanRequest): Promise<ArchiveDirectoryScanResult> {
  return invoke<ArchiveDirectoryScanResult>('scan_archive_directory', { request });
}

export function getDownloadDirectory(): Promise<string> {
  return invoke<string>('get_download_directory');
}

export function startBatch(request: StartBatchPayload): Promise<string> {
  return invoke<string>('start_batch', { request });
}

export function cancelJob(jobId: string): Promise<boolean> {
  return invoke<boolean>('cancel_job', { jobId });
}

export function pauseJob(jobId: string): Promise<boolean> {
  return invoke<boolean>('pause_job', { jobId });
}

export function resumeJob(jobId: string): Promise<boolean> {
  return invoke<boolean>('resume_job', { jobId });
}

export function preflightJobs(request: PreflightRequest): Promise<PreflightResult> {
  return invoke<PreflightResult>('preflight_jobs', { request });
}

export function writeTextFile(path: string, content: string): Promise<void> {
  return invoke<void>('write_text_file', { path, content });
}

export function readTextFile(path: string): Promise<string> {
  return invoke<string>('read_text_file', { path });
}

export const writeLogFile = writeTextFile;

export function openOutput(path: string): Promise<void> {
  return invoke<void>('open_output', { path });
}

export function deleteExtraction(manifestPath: string, deleteReplaced: boolean): Promise<DeleteExtractionResult> {
  return invoke<DeleteExtractionResult>('delete_extraction', { manifestPath, deleteReplaced });
}

export function installClaudeDat(directory: string, overwrite = true): Promise<string> {
  return invoke<string>('install_claude_dat', { directory, overwrite });
}

export function checkClaudeCli(): Promise<ClaudeCliStatus> {
  return invoke<ClaudeCliStatus>('check_claude_cli');
}

export function launchClaudeFromDat(directory: string): Promise<ClaudeLaunchResult> {
  return invoke<ClaudeLaunchResult>('launch_claude_dat', { directory });
}


export function installBackgroundImage(source: string): Promise<string> {
  return invoke<string>('install_background_image', { source });
}

export function clearBackgroundImage(): Promise<void> {
  return invoke<void>('clear_background_image');
}

export async function registerBackendEvents(handlers: {
  onProgress: (event: ProgressEvent) => void;
  onJobFinished: (event: JobFinishedEvent) => void;
  onBatchFinished: (event: BatchFinishedEvent) => void;
}): Promise<UnlistenFn[]> {
  const unlisteners = await Promise.all([
    listen<ProgressEvent>('extract-progress', (event) => handlers.onProgress(event.payload)),
    listen<JobFinishedEvent>('extract-finished', (event) => handlers.onJobFinished(event.payload)),
    listen<BatchFinishedEvent>('batch-finished', (event) => handlers.onBatchFinished(event.payload)),
  ]);
  return unlisteners;
}

export interface AppFileDropEvent {
  type: 'enter' | 'over' | 'drop' | 'leave';
  paths: string[];
  clientX?: number;
  clientY?: number;
}

export async function registerFileDrop(handler: (event: AppFileDropEvent) => void): Promise<UnlistenFn> {
  const scaleFactor = await getCurrentWindow().scaleFactor();
  return getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type === 'leave') {
      handler({ type: 'leave', paths: [] });
      return;
    }
    const { x, y } = event.payload.position;
    handler({
      type: event.payload.type,
      paths: 'paths' in event.payload ? event.payload.paths : [],
      clientX: x / scaleFactor,
      clientY: y / scaleFactor,
    });
  });
}
