import type { AppSettings, ArchiveFile, Channel } from '../types';

export type ChannelRunState = 'idle' | 'queued' | 'processing' | 'paused' | 'done' | 'error';

export function getChannelStatus(channel: Channel): ChannelRunState {
  if (channel.files.some((file) => file.status === 'processing')) return 'processing';
  if (channel.files.some((file) => file.status === 'paused')) return 'paused';
  if (channel.files.some((file) => file.status === 'queued')) return 'queued';
  if (channel.files.some((file) => file.status === 'error')) return 'error';
  if (channel.files.length > 0 && channel.files.every((file) => file.status === 'success')) return 'done';
  return 'idle';
}

export function getChannelProgress(channel: Channel): number {
  if (!channel.files.length) return 0;
  return Math.round(channel.files.reduce((sum, file) => sum + file.progress, 0) / channel.files.length);
}

export function getVisibleFiles(channel: Channel, settings: AppSettings): ArchiveFile[] {
  const files = channel.files.filter((file) => {
    if (settings.hideCompletedFiles && file.status === 'success') return false;
    if (!settings.showUnsupportedFiles && !file.supported) return false;
    return true;
  });
  if (channel.fileSort === 'name') return [...files].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  if (channel.fileSort === 'size') return [...files].sort((a, b) => b.size - a.size);
  if (channel.fileSort === 'status') {
    const order: Record<ArchiveFile['status'], number> = {
      processing: 0,
      paused: 1,
      queued: 2,
      error: 3,
      pending: 4,
      cancelled: 5,
      success: 6,
    };
    return [...files].sort((a, b) => order[a.status] - order[b.status]);
  }
  return files;
}

export function findArchiveFile(channels: Channel[], jobId: string): { channel: Channel; file: ArchiveFile } | null {
  for (const channel of channels) {
    const file = channel.files.find((item) => item.id === jobId);
    if (file) return { channel, file };
  }
  return null;
}
