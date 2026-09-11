<script setup lang="ts">
import { computed } from 'vue';
import { useChannelStore } from '../stores/channels';

const store = useChannelStore();
const sortedLogs = computed(() => store.logs);

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}
</script>

<template>
  <div v-if="store.logDrawerOpen" class="drawer-backdrop" @click.self="store.logDrawerOpen = false">
    <aside class="log-drawer" aria-label="处理日志">
      <header class="drawer-head">
        <div>
          <h2>处理日志</h2>
          <p>保留最近 2,000 条前端处理记录</p>
        </div>
        <div class="drawer-actions">
          <button class="btn btn-sm" type="button" :disabled="!store.logs.length" @click="store.exportLogs">导出 JSON</button>
          <button class="btn btn-ghost" type="button" aria-label="关闭日志" @click="store.logDrawerOpen = false">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      </header>
      <div v-if="sortedLogs.length" class="log-list">
        <article v-for="entry in sortedLogs" :key="entry.id" class="log-entry" :class="`log-${entry.level}`">
          <time>{{ formatTime(entry.timestamp) }}</time>
          <div class="log-copy">
            <div class="log-context">
              <span v-if="entry.channelName">{{ entry.channelName }}</span>
              <span v-if="entry.fileName">{{ entry.fileName }}</span>
            </div>
            <p>{{ entry.message }}</p>
          </div>
        </article>
      </div>
      <div v-else class="empty-log">暂无日志。开始解压后，进度和错误会显示在这里。</div>
    </aside>
  </div>
</template>
