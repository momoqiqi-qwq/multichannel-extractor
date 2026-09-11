<script setup lang="ts">
import { computed } from 'vue';
import { useChannelStore } from '../stores/channels';
import { useTaskCenterStore } from '../stores/taskCenter';
import type { TaskRecord } from '../types';

const workspace = useChannelStore();
const tasks = useTaskCenterStore();
const running = computed(() => tasks.activeCount > 0);
const deletableCount = computed(() => tasks.records.filter((record) => record.manifestPath && !record.outputDeleted).length);

function formatTime(value?: string): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function statusText(record: TaskRecord): string {
  const labels: Record<TaskRecord['status'], string> = {
    queued: '排队中',
    processing: '处理中',
    paused: '已暂停',
    success: '已完成',
    error: '失败',
    cancelled: '已取消',
    interrupted: '异常中断',
    recovered: '已恢复',
    deleted: '结果已删除',
  };
  return labels[record.status];
}

function formatEta(seconds?: number): string {
  if (!seconds || seconds <= 0) return '—';
  if (seconds < 60) return `约 ${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return minutes < 60 ? `约 ${minutes} 分钟` : `约 ${(minutes / 60).toFixed(1)} 小时`;
}

function syncDeletedManifest(manifestPath: string, message: string): void {
  for (const channel of workspace.channels) {
    const file = channel.files.find((item) => item.manifestPath === manifestPath);
    if (file) {
      file.outputDeleted = true;
      file.manifestPath = undefined;
      file.message = message;
    }
  }
}

async function deleteOutput(record: TaskRecord): Promise<void> {
  if (!record.manifestPath) return;
  const deleteReplaced = workspace.appSettings.deleteReplacedOutputs;
  if (workspace.appSettings.confirmBeforeDeleteOutput) {
    const detail = record.replacedFiles && !deleteReplaced
      ? `本次有 ${record.replacedFiles} 个文件覆盖了旧内容；安全模式会保留它们。`
      : record.replacedFiles
        ? `本次有 ${record.replacedFiles} 个文件覆盖了旧内容，它们也会被删除。`
        : '只会删除任务清单记录的文件和本次创建的空目录。';
    if (!window.confirm(`删除“${record.fileName}”的解压结果吗？\n${detail}`)) return;
  }
  try {
    const manifestPath = record.manifestPath;
    const result = await tasks.deleteRecordOutput(record, deleteReplaced);
    syncDeletedManifest(manifestPath, record.message);
    workspace.pushToast({
      level: 'success',
      title: '解压结果已删除',
      message: result.skippedReplacedFiles
        ? `删除 ${result.deletedFiles} 个新增文件，保留 ${result.skippedReplacedFiles} 个替换文件`
        : `删除 ${result.deletedFiles} 个文件`,
    });
  } catch (error) {
    workspace.pushToast({ level: 'error', title: '删除解压结果失败', message: String(error) });
  }
}

async function deleteAllOutputs(): Promise<void> {
  const candidates = tasks.records.filter((record) => record.manifestPath && !record.outputDeleted);
  if (!candidates.length) return;
  const replaced = candidates.reduce((sum, record) => sum + (record.replacedFiles || 0), 0);
  const deleteReplaced = workspace.appSettings.deleteReplacedOutputs;
  const detail = replaced && !deleteReplaced
    ? `安全模式会保留 ${replaced} 个曾被替换的文件。`
    : replaced
      ? `其中 ${replaced} 个文件曾替换旧内容，也会被删除。`
      : '只删除任务清单记录的文件与本次创建的空目录。';
  if (!window.confirm(`删除 ${candidates.length} 个任务的解压结果吗？
${detail}`)) return;

  let deleted = 0;
  let skipped = 0;
  let failed = 0;
  for (const record of candidates) {
    const manifestPath = record.manifestPath!;
    try {
      const result = await tasks.deleteRecordOutput(record, deleteReplaced);
      deleted += result.deletedFiles;
      skipped += result.skippedReplacedFiles;
      syncDeletedManifest(manifestPath, record.message);
    } catch {
      failed += 1;
    }
  }
  workspace.pushToast({
    level: failed ? 'warn' : 'success',
    title: failed ? `已删除，但有 ${failed} 个任务失败` : '全部解压结果已删除',
    message: `删除 ${deleted} 个文件${skipped ? ` · 保留 ${skipped} 个替换文件` : ''}`,
    timeoutMs: 7000,
  });
}

async function openOutput(record: TaskRecord): Promise<void> {
  try {
    await tasks.openRecordOutput(record);
  } catch (error) {
    workspace.pushToast({ level: 'error', title: '无法打开输出目录', message: String(error) });
  }
}
</script>

<template>
  <div v-if="tasks.drawerOpen" class="drawer-backdrop" @mousedown.self="tasks.drawerOpen = false">
    <aside class="task-drawer" role="dialog" aria-modal="true" aria-labelledby="task-center-title">
      <header class="drawer-head">
        <div>
          <h2 id="task-center-title">任务中心</h2>
          <p>运行进度、历史结果、失败重试与安全删除</p>
        </div>
        <div class="drawer-actions">
          <span v-if="running" class="task-live-badge">{{ tasks.activeCount }} 个运行中</span>
          <button class="btn btn-ghost" type="button" @click="tasks.drawerOpen = false">关闭</button>
        </div>
      </header>

      <div class="task-toolbar">
        <label class="search-box task-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <input v-model="tasks.search" type="search" placeholder="搜索文件、通道、路径" />
        </label>
        <select v-model="tasks.filter" class="toolbar-select">
          <option value="all">全部任务</option>
          <option value="active">运行中</option>
          <option value="success">已完成</option>
          <option value="error">失败与中断</option>
        </select>
        <button v-if="tasks.recoverableRecords.length" class="btn btn-primary btn-sm" type="button" :disabled="tasks.activeCount > 0" @click="workspace.resumeInterruptedTasks(false)">恢复 {{ tasks.recoverableRecords.length }} 个中断任务</button>
        <button v-if="deletableCount" class="btn btn-ghost btn-sm danger-hover" type="button" :disabled="tasks.activeCount > 0" @click="deleteAllOutputs">删除全部解压结果</button>
        <button class="btn btn-ghost btn-sm" type="button" :disabled="tasks.activeCount > 0" @click="tasks.clearCompleted">清理历史</button>
      </div>

      <div v-if="tasks.visibleRecords.length" class="task-list">
        <article v-for="record in tasks.visibleRecords" :key="record.id" class="task-card" :data-state="record.status">
          <div class="task-card-head">
            <div class="task-title">
              <b :title="record.fileName">{{ record.fileName }}</b>
              <span>{{ record.channelName }}</span>
            </div>
            <span class="task-status" :class="`task-status-${record.status}`">{{ statusText(record) }}</span>
          </div>
          <div class="task-progress" aria-hidden="true"><i :style="{ width: `${record.progress}%` }" /></div>
          <p class="task-message">{{ record.message }}</p>
          <dl class="task-meta">
            <div><dt>开始</dt><dd>{{ formatTime(record.startedAt || record.createdAt) }}</dd></div>
            <div><dt>耗时</dt><dd>{{ record.durationMs == null ? '—' : `${(record.durationMs / 1000).toFixed(1)}s` }}</dd></div>
            <div><dt>写入</dt><dd>{{ record.writtenFiles }} 个文件</dd></div>
            <div v-if="workspace.appSettings.showEta && ['queued', 'processing'].includes(record.status)"><dt>剩余</dt><dd>{{ formatEta(record.etaSeconds) }}</dd></div>
            <div v-if="record.replacedFiles"><dt>替换</dt><dd>{{ record.replacedFiles }} 个</dd></div>
          </dl>
          <code class="task-path" :title="record.archivePath">{{ record.archivePath }}</code>
          <div class="task-actions">
            <button v-if="record.status === 'interrupted'" class="btn btn-primary btn-sm" type="button" :disabled="workspace.processingFiles > 0 || !record.jobSnapshot" @click="workspace.resumeInterruptedTask(record.id)">恢复任务</button>
            <button v-else-if="['error', 'cancelled', 'success', 'recovered', 'deleted'].includes(record.status)" class="btn btn-sm" type="button" :disabled="workspace.processingFiles > 0 || (!record.jobSnapshot && !workspace.channels.some((channel) => channel.files.some((file) => file.id === record.jobId)))" @click="workspace.rerunTaskRecord(record.id)">重新运行</button>
            <button v-if="workspace.appSettings.enablePauseResume && ['queued', 'processing'].includes(record.status)" class="btn btn-sm" type="button" @click="workspace.pauseFile(record.jobId)">暂停</button>
            <button v-if="record.status === 'paused'" class="btn btn-primary btn-sm" type="button" @click="workspace.resumeFile(record.jobId)">继续</button>
            <button v-if="record.outputPath && !record.outputDeleted" class="btn btn-sm" type="button" @click="openOutput(record)">打开目录</button>
            <button v-if="record.manifestPath && !record.outputDeleted" class="btn btn-ghost btn-sm danger-hover" type="button" @click="deleteOutput(record)">删除解压文件</button>
            <button class="btn btn-ghost btn-sm" type="button" @click="tasks.removeRecord(record.id)">移除记录</button>
          </div>
        </article>
      </div>
      <div v-else class="task-empty">
        <b>暂无匹配任务</b>
        <span>开始解压后，运行进度和历史结果会保存在这里。</span>
      </div>
    </aside>
  </div>
</template>
