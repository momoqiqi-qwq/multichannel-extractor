<script setup lang="ts">
import { computed } from 'vue';
import { useChannelStore } from '../stores/channels';
import type { ArchiveFile, Channel, FileStatus } from '../types';

const props = defineProps<{ channel: Channel }>();
const store = useChannelStore();
const visibleFiles = computed(() => store.visibleFiles(props.channel));
const hiddenFileCount = computed(() => props.channel.files.length - visibleFiles.value.length);
const canScanLatest = computed(() => store.canScanLatest(props.channel));

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function statusLabel(file: ArchiveFile): string {
  if (file.outputDeleted) return '结果已删除';
  if (file.status === 'error') return file.message || '失败';
  const stateLabels: Record<Exclude<FileStatus, 'error'>, string> = {
    pending: '待处理',
    queued: '等待中',
    processing: `${file.progress}%`,
    paused: `已暂停 · ${file.progress}%`,
    success: '完成',
    cancelled: '已取消',
  };
  const parts = [stateLabels[file.status as Exclude<FileStatus, 'error'>]];
  if (store.appSettings.showFileFormat && file.format && file.format !== 'UNKNOWN') parts.push(file.format);
  if (store.appSettings.showFileSize) parts.push(formatBytes(file.size));
  return parts.join(' · ');
}

function fileStateIcon(file: ArchiveFile): string {
  if (file.outputDeleted) return 'stop';
  if (file.status === 'success') return 'check';
  if (file.status === 'error') return 'error';
  if (file.status === 'processing') return 'spinner';
  if (file.status === 'paused') return 'pause';
  if (file.status === 'cancelled') return 'stop';
  return 'file';
}
</script>

<template>
  <div class="cell-files">
    <div v-if="visibleFiles.length" class="filelist">
      <article
        v-for="file in visibleFiles"
        :key="file.id"
        class="file-chip"
        :class="[`file-${file.status}`, { 'output-deleted': file.outputDeleted }]"
        :title="`${file.path}\n${file.message || ''}`"
      >
        <svg v-if="fileStateIcon(file) === 'check'" class="file-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 13l4 4L19 7" /></svg>
        <svg v-else-if="fileStateIcon(file) === 'error'" class="file-err" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 8v5M12 16h.01M10.3 3.3l-8 14A2 2 0 004 20h16a2 2 0 001.7-2.7l-8-14a2 2 0 00-3.4 0z" /></svg>
        <svg v-else-if="fileStateIcon(file) === 'spinner'" class="file-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 12a8 8 0 10-8 8" /></svg>
        <svg v-else-if="fileStateIcon(file) === 'pause'" class="file-err" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 5v14M16 5v14" /></svg>
        <svg v-else-if="fileStateIcon(file) === 'stop'" class="file-err" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
        <svg v-else class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h10l6 6v10a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" /></svg>
        <div class="file-chip-copy">
          <div class="file-chip-main">
            <span class="file-name">{{ file.name }}</span>
            <span class="file-meta" :class="{ danger: file.status === 'error' }">{{ statusLabel(file) }}</span>
          </div>
          <div v-if="['queued', 'processing', 'paused'].includes(file.status)" class="file-mini-progress"><span :style="{ width: `${file.progress}%` }" /></div>
        </div>
        <button v-if="file.status === 'success' && file.outputPath && !file.outputDeleted" class="file-output-button" type="button" title="打开此文件的输出目录" @click="store.openFileOutput(file.id)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
        </button>
        <button v-if="file.status === 'success' && file.outputPath && !file.outputDeleted" class="file-output-button" type="button" title="使用此文件实际解压目录中的项目 DAT 启动 Claude；没有 DAT 时会先生成" @click="store.launchClaudeForFile(file.id)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 7l4 4-4 4M11 17h8" /><rect x="2.5" y="3.5" width="19" height="17" rx="2" /></svg>
        </button>
        <button v-if="file.status === 'success' && file.manifestPath && !file.outputDeleted" class="file-output-button file-delete-output-button" type="button" title="删除本次解压生成的文件" @click="store.deleteFileOutput(file.id)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 7h14M9 7V4h6v3M8 10v8M12 10v8M16 10v8M7 7l1 14h8l1-14" /></svg>
        </button>
        <button v-if="file.status === 'success'" class="file-output-button file-rerun-button" type="button" title="按当前层级和输出设置重新解压" @click="store.rerunFile(file.id)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 7v5h-5" /><path d="M19 12a7 7 0 10-2 5" /></svg>
        </button>
        <select v-if="store.appSettings.enableFilePriority && ['pending', 'error', 'cancelled'].includes(file.status)" v-model="file.priority" class="file-priority" title="任务优先级" aria-label="任务优先级">
          <option value="high">高</option><option value="normal">普通</option><option value="low">低</option>
        </select>
        <button v-if="store.appSettings.enablePauseResume && ['queued', 'processing'].includes(file.status)" class="file-output-button" type="button" title="暂停任务" @click="store.pauseFile(file.id)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 5v14M16 5v14" /></svg>
        </button>
        <button v-if="file.status === 'paused'" class="file-output-button" type="button" title="继续任务" @click="store.resumeFile(file.id)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 4l13 8-13 8V4z" /></svg>
        </button>
        <button v-if="['queued', 'processing', 'paused'].includes(file.status)" class="file-remove" type="button" title="取消任务" @click="store.cancelFile(file.id)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="6" width="12" height="12" /></svg>
        </button>
        <button v-else class="file-remove" type="button" title="移除该文件" @click="store.removeFile(channel.id, file.id)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </article>
    </div>
    <button v-else-if="channel.files.length === 0" class="empty-drop" type="button" @click="store.browseFiles(channel.id)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 4v12M6 10l6 6 6-6M5 20h14" /></svg>
      {{ canScanLatest ? '拖拽压缩文件到整行，或点右侧“扫描最新版并开始”' : '拖拽压缩文件到整行，或点击选择' }}
    </button>
    <div v-else class="filtered-files-hint">已按显示设置隐藏 {{ hiddenFileCount }} 个文件</div>
  </div>
</template>
