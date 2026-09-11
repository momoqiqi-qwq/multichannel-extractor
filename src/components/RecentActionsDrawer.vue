<script setup lang="ts">
import { computed } from 'vue';
import { useChannelStore } from '../stores/channels';
import { useWorkspaceHistoryStore } from '../stores/workspaceHistory';

const store = useChannelStore();
const history = useWorkspaceHistoryStore();
const formatter = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const undoDisabled = computed(() => !history.canUndo || store.processingFiles > 0);

function undo(): void {
  store.undoLastAction();
}
</script>

<template>
  <div v-if="history.drawerOpen" class="drawer-backdrop" role="presentation" @mousedown.self="history.drawerOpen = false">
    <aside class="history-drawer" role="dialog" aria-modal="true" aria-labelledby="history-title">
      <header class="drawer-head">
        <div><h2 id="history-title">最近操作</h2><p>记录本次运行中的常用操作；可撤销会改动工作区结构的最近操作。</p></div>
        <button class="btn btn-ghost btn-sm" type="button" @click="history.drawerOpen = false">关闭</button>
      </header>
      <div class="history-toolbar">
        <button class="btn btn-primary btn-sm" type="button" :disabled="undoDisabled" :title="store.processingFiles > 0 ? '任务运行中暂不允许撤销工作区结构' : history.lastUndoLabel ? `撤销：${history.lastUndoLabel}` : '没有可撤销操作'" @click="undo">撤销上一步</button>
        <button class="btn btn-ghost btn-sm" type="button" :disabled="!history.recentActions.length" @click="history.clearRecent">清空记录</button>
      </div>
      <div class="history-list">
        <div v-for="action in history.recentActions" :key="action.id" class="history-item">
          <span class="history-action-icon" :class="{ undoable: action.undoable }">{{ action.undoable ? '↶' : '·' }}</span>
          <span><b>{{ action.label }}</b><small>{{ formatter.format(new Date(action.at)) }}{{ action.undoable ? ' · 可撤销' : '' }}</small></span>
        </div>
        <div v-if="!history.recentActions.length" class="settings-empty">还没有最近操作。新建、复制、删除、排序、套用预设等操作会显示在这里。</div>
      </div>
    </aside>
  </div>
</template>
