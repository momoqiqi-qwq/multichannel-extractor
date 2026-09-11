<script setup lang="ts">
import { computed, ref } from 'vue';
import { useChannelStore } from '../stores/channels';
import { useTaskCenterStore } from '../stores/taskCenter';
import { EXTRACTION_HISTORY_LIMIT_OPTIONS } from '../config/appearance';
import type { TaskRecord } from '../types';

const workspace = useChannelStore();
const tasks = useTaskCenterStore();
const search = ref('');

const limit = computed(() => {
  const value = Number(workspace.appSettings.extractionHistoryLimit);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 20;
});

const records = computed(() => {
  const query = search.value.trim().toLocaleLowerCase();
  const slice = tasks.recentExtractions(limit.value);
  if (!query) return slice;
  return slice.filter((record) =>
    [record.fileName, record.channelName, record.archivePath, record.outputPath || '']
      .some((value) => value.toLocaleLowerCase().includes(query)),
  );
});

const successCount = computed(() => records.value.filter((record) => record.status === 'success').length);
const opener = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

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

function formatTime(value?: string): string {
  if (!value) return '—';
  return opener.format(new Date(value));
}

function formatDuration(ms?: number): string {
  if (ms == null) return '—';
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}m ${rest}s`;
}

async function openOutput(record: TaskRecord): Promise<void> {
  try {
    await tasks.openRecordOutput(record);
  } catch (error) {
    workspace.pushToast({ level: 'error', title: '无法打开输出目录', message: String(error) });
  }
}

function rerun(record: TaskRecord): void {
  workspace.rerunTaskRecord(record.id);
}

function openTaskCenter(): void {
  tasks.drawerOpen = true;
  tasks.historyDrawerOpen = false;
}
</script>

<template>
  <div v-if="tasks.historyDrawerOpen" class="drawer-backdrop" @mousedown.self="tasks.historyDrawerOpen = false">
    <aside class="history-drawer extraction-history-drawer" role="dialog" aria-modal="true" aria-labelledby="extraction-history-title">
      <header class="drawer-head">
        <div>
          <h2 id="extraction-history-title">解压历史</h2>
          <p>最近 {{ limit }} 次解压结果；条数可在「设置 · 可靠性」中调整。</p>
        </div>
        <div class="drawer-actions">
          <span v-if="records.length" class="extraction-history-badge">{{ records.length }} 条 · 成功 {{ successCount }}</span>
          <button class="btn btn-ghost" type="button" @click="tasks.historyDrawerOpen = false">关闭</button>
        </div>
      </header>

      <div class="history-toolbar">
        <label class="search-box extraction-history-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <input v-model="search" type="search" placeholder="搜索文件名、通道或路径" />
        </label>
        <button class="btn btn-ghost btn-sm" type="button" @click="openTaskCenter">查看全部任务</button>
      </div>

      <div v-if="records.length" class="history-list extraction-history-list">
        <article v-for="record in records" :key="record.id" class="task-card" :data-state="record.status">
          <div class="task-card-head">
            <div class="task-title">
              <b :title="record.fileName">{{ record.fileName }}</b>
              <span>{{ record.channelName }} · {{ formatTime(record.finishedAt || record.startedAt || record.createdAt) }}</span>
            </div>
            <span class="task-status" :class="`task-status-${record.status}`">{{ statusText(record) }}</span>
          </div>
          <p class="task-message">{{ record.message }}</p>
          <dl class="task-meta">
            <div><dt>耗时</dt><dd>{{ formatDuration(record.durationMs) }}</dd></div>
            <div><dt>写入</dt><dd>{{ record.writtenFiles }} 个</dd></div>
            <div v-if="record.replacedFiles"><dt>替换</dt><dd>{{ record.replacedFiles }} 个</dd></div>
          </dl>
          <code class="task-path" :title="record.archivePath">{{ record.archivePath }}</code>
          <div class="task-actions">
            <button v-if="record.outputPath && !record.outputDeleted" class="btn btn-sm" type="button" @click="openOutput(record)">打开目录</button>
            <button class="btn btn-ghost btn-sm" type="button" :disabled="workspace.processingFiles > 0" @click="rerun(record)">重新运行</button>
          </div>
        </article>
      </div>
      <div v-else class="task-empty">
        <b>{{ search ? '没有匹配的解压记录' : '还没有解压历史' }}</b>
        <span>{{ search ? '换个关键词试试，或清空搜索查看最近几次解压。' : '完成一次解压后，最近几次的结果会显示在这里。' }}</span>
      </div>
    </aside>
  </div>
</template>
