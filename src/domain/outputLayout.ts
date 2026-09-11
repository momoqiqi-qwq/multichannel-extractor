import type { Channel, DepthModeType } from '../types';
import { displayPath } from '../utils/path';

const COMPOUND_SUFFIXES = ['.tar.gz', '.tar.bz2', '.tar.xz', '.tbz2', '.tbz', '.tgz', '.txz'];
const SIMPLE_SUFFIXES = ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'];

export function archiveStem(fileName: string): string {
  const normalized = fileName.trim();
  const lower = normalized.toLocaleLowerCase();
  const suffix = [...COMPOUND_SUFFIXES, ...SIMPLE_SUFFIXES].find((item) => lower.endsWith(item));
  const stem = suffix ? normalized.slice(0, -suffix.length) : normalized.replace(/\.[^.]+$/, '');
  return stem.trim() || '压缩包名称';
}

export function depthModeDescription(mode: DepthModeType, depth: number): string {
  if (mode === 'preserve') return '保留归档内的全部目录结构';
  if (mode === 'skipOuter') return '内容只有一个公共根目录时，移除这一层';
  if (depth <= 0) return '不保留任何目录，所有文件直接写入输出容器';
  return `保留前 ${depth} 层目录，后续目录拍平`;
}

function mappedExample(channel: Channel): string[] {
  const source = ['根目录', '资料', '图片', '示例文件.txt'];
  if (channel.depthMode === 'preserve') return source;
  if (channel.depthMode === 'skipOuter') return source.slice(1);
  const depth = Math.max(0, Math.min(32, Math.floor(channel.depth || 0)));
  return [...source.slice(0, depth), source[source.length - 1]];
}

export function outputLayoutExample(channel: Channel): string {
  const fileName = channel.files[0]?.name ?? '示例压缩包.zip';
  const base = channel.useArchiveDirectory
    ? '压缩包所在目录'
    : channel.destination.trim()
      ? displayPath(channel.destination)
      : '尚未选择的目标目录';
  const components = [base];
  if (channel.createArchiveSubfolder) components.push(archiveStem(fileName));
  components.push(...mappedExample(channel));
  return components.join(' / ');
}

export function outputContainerDescription(channel: Channel): string {
  return channel.createArchiveSubfolder
    ? '每个压缩包先创建一个同名输出文件夹；层级规则只处理该文件夹里面的归档路径。'
    : '不额外创建压缩包同名文件夹；层级规则直接作用于目标目录。';
}
