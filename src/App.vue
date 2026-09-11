<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { UnlistenFn } from '@tauri-apps/api/event';
import ChannelCard from './components/ChannelCard.vue';
import CommandPalette from './components/CommandPalette.vue';
import RecentActionsDrawer from './components/RecentActionsDrawer.vue';
import ExtractionHistoryDrawer from './components/ExtractionHistoryDrawer.vue';
import LogDrawer from './components/LogDrawer.vue';
import QuickSettings from './components/QuickSettings.vue';
import ProjectCenterDrawer from './components/ProjectCenterDrawer.vue';
import SettingsDrawer from './components/SettingsDrawer.vue';
import TaskCenterDrawer from './components/TaskCenterDrawer.vue';
import StartReviewDialog from './components/StartReviewDialog.vue';
import ToastHost from './components/ToastHost.vue';
import { CHANNEL_CATEGORIES } from './config/appearance';
import { getStartupArchivePaths, registerBackendEvents, registerFileDrop } from './services/tauri';
import { useChannelStore } from './stores/channels';
import { useTaskCenterStore } from './stores/taskCenter';
import { useProjectCenterStore } from './stores/projectCenter';
import { useWorkspaceHistoryStore } from './stores/workspaceHistory';
import type { Channel, ChannelCategory, ChannelStatus } from './types';

const store = useChannelStore();
const taskCenter = useTaskCenterStore();
const projectCenter = useProjectCenterStore();
const history = useWorkspaceHistoryStore();
const unlisteners: UnlistenFn[] = [];
const allExpanded = computed(() => store.channels.length > 0 && store.channels.every((channel) => channel.expanded));
const backendConnected = ref(true);
const searchQuery = ref('');
const workspaceSearchInput = ref<HTMLInputElement | null>(null);
const commandPaletteOpen = ref(false);
const categoryFilter = ref<'all' | ChannelCategory>('all');
const statusFilter = ref<'all' | ChannelStatus>('all');
const newChannelCategory = ref<ChannelCategory>(store.appSettings.defaultCategory);
const keywordChannelCount = computed(() => store.channels.filter((channel) => channel.inboxEnabled && channel.inboxDirectory.trim() && channel.inboxKeywords.trim()).length);
const keywordScanning = computed(() => store.inboxScanningIds.length > 0);
const hasActiveWorkspaceFilter = computed(() => Boolean(searchQuery.value.trim()) || categoryFilter.value !== 'all' || statusFilter.value !== 'all');
let hoveredChannelId: string | null = null;

const categoryMap = new Map(CHANNEL_CATEGORIES.map((item) => [item.id, item]));

const displayedChannels = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();
  const filtered = store.channels.filter((channel) => {
    const matchesQuery =
      !query ||
      channel.name.toLocaleLowerCase().includes(query) ||
      channel.note.toLocaleLowerCase().includes(query) ||
      channel.inboxKeywords.toLocaleLowerCase().includes(query) ||
      channel.inboxDirectory.toLocaleLowerCase().includes(query) ||
      channel.files.some((file) => file.name.toLocaleLowerCase().includes(query));
    const matchesCategory = categoryFilter.value === 'all' || channel.category === categoryFilter.value;
    const matchesStatus = statusFilter.value === 'all' || store.channelStatus(channel) === statusFilter.value;
    return matchesQuery && matchesCategory && matchesStatus;
  });

  const sorted = [...filtered];
  if (store.appSettings.channelSort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  if (store.appSettings.channelSort === 'category') sorted.sort((a, b) => a.category.localeCompare(b.category));
  if (store.appSettings.channelSort === 'status') {
    const order: Record<ChannelStatus, number> = { processing: 0, paused: 1, queued: 2, error: 3, idle: 4, done: 5 };
    sorted.sort((a, b) => order[store.channelStatus(a)] - order[store.channelStatus(b)]);
  }
  return sorted;
});

const channelGroups = computed(() => {
  if (!store.appSettings.groupByCategory) return [{ id: 'all', name: '', color: '', channels: displayedChannels.value }];
  return CHANNEL_CATEGORIES.map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    channels: displayedChannels.value.filter((channel) => channel.category === category.id),
  })).filter((group) => group.channels.length > 0);
});

function originalIndex(channel: Channel): number {
  return store.channels.findIndex((item) => item.id === channel.id);
}

function findChannelAt(clientX?: number, clientY?: number): string | null {
  if (clientX === undefined || clientY === undefined) return null;
  const element = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-channel-id]');
  return element?.dataset.channelId || null;
}

function clearDragState(): void {
  if (hoveredChannelId) store.setDragActive(hoveredChannelId, false);
  hoveredChannelId = null;
}

function createChannel(): void {
  store.addChannel(newChannelCategory.value);
}

function clearWorkspaceFilters(): void {
  searchQuery.value = '';
  categoryFilter.value = 'all';
  statusFilter.value = 'all';
}

function closeTransientPanels(): void {
  document.querySelector<HTMLDetailsElement>('.quick-settings[open]')?.removeAttribute('open');
  store.settingsOpen = false;
  store.logDrawerOpen = false;
  taskCenter.drawerOpen = false;
  taskCenter.historyDrawerOpen = false;
  projectCenter.drawerOpen = false;
  history.drawerOpen = false;
  commandPaletteOpen.value = false;
}

function openSettings(): void {
  closeTransientPanels();
  store.settingsOpen = true;
}

function openLogs(): void {
  closeTransientPanels();
  store.logDrawerOpen = true;
}

function openTaskCenter(): void {
  closeTransientPanels();
  taskCenter.drawerOpen = true;
}

function openProjectCenter(): void {
  closeTransientPanels();
  projectCenter.drawerOpen = true;
}

function openRecentActions(): void {
  closeTransientPanels();
  history.drawerOpen = true;
}

function openExtractionHistory(): void {
  closeTransientPanels();
  taskCenter.historyDrawerOpen = true;
}

function openCommandPalette(): void {
  closeTransientPanels();
  commandPaletteOpen.value = true;
}

function focusWorkspaceSearch(): void {
  closeTransientPanels();
  if (store.appSettings.showWorkspaceSearch) window.setTimeout(() => workspaceSearchInput.value?.focus(), 20);
}

function handleShortcut(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  const editing = target?.matches('input, textarea, select, [contenteditable="true"]');
  if (event.key === 'Escape') {
    closeTransientPanels();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    openCommandPalette();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !editing) {
    event.preventDefault();
    store.undoLastAction();
    return;
  }
  if (editing) return;
  if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && store.appSettings.showWorkspaceSearch) {
    event.preventDefault();
    workspaceSearchInput.value?.focus();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
    event.preventDefault();
    createChannel();
  }
  if ((event.ctrlKey || event.metaKey) && event.key === ',') {
    event.preventDefault();
    openSettings();
  }
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    void store.scanAllKeywordChannels();
  }
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'p') {
    event.preventDefault();
    openProjectCenter();
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && store.hasStartableWork && store.processingFiles === 0 && store.inboxScanningIds.length === 0) {
    event.preventDefault();
    void store.startAll();
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleShortcut);
  try {
    unlisteners.push(
      ...(await registerBackendEvents({
        onProgress: store.onProgress,
        onJobFinished: store.onJobFinished,
        onBatchFinished: store.onBatchFinished,
      })),
    );
    if (store.appSettings.autoResumeInterrupted && taskCenter.recoverableRecords.length) {
      window.setTimeout(() => void store.resumeInterruptedTasks(true), 350);
    }
    if (store.appSettings.autoScanKeywordChannelsOnLaunch) {
      window.setTimeout(() => void store.scanAllKeywordChannels(true), 650);
    }
    unlisteners.push(
      await registerFileDrop(async (event) => {
        if (event.type === 'leave') {
          clearDragState();
          return;
        }
        const channelId = findChannelAt(event.clientX, event.clientY);
        if (channelId !== hoveredChannelId) {
          clearDragState();
          hoveredChannelId = channelId;
          if (channelId) store.setDragActive(channelId, true);
        }
        if (event.type === 'drop') {
          clearDragState();
          if (!event.paths.length) return;
          if (channelId) await store.addPathsToChannel(channelId, event.paths);
          else await store.routePathsToChannels(event.paths, 'drop');
        }
      }),
    );
    const startupPaths = await getStartupArchivePaths();
    if (startupPaths.length) await store.routePathsToChannels(startupPaths, 'startup');
  } catch (error) {
    backendConnected.value = false;
    store.pushToast({
      level: 'warn',
      title: '当前是浏览器预览模式',
      message: '文件与目录选择器需要通过 npm run tauri dev 启动桌面应用；界面设置仍可预览。',
      timeoutMs: 9000,
    });
    console.warn('Tauri API is unavailable. The UI can still be previewed in a browser.', error);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleShortcut);
  clearDragState();
  unlisteners.splice(0).forEach((unlisten) => unlisten());
});
</script>

<template>
  <div class="app-shell" :data-descriptions="store.appSettings.hideDescriptions ? 'hidden' : 'shown'" :data-detailed-explanations="store.appSettings.showDetailedExplanations ? 'shown' : 'hidden'" :data-workspace-width="store.appSettings.workspaceWidth">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true"><span /><span /><span /></div>
        <div>
          <div class="brand-title">解压台</div>
          <div v-if="store.appSettings.showBrandSubtitle" class="brand-sub">多通道批量解压 · Tauri 2 + Rust</div>
        </div>
      </div>

      <div class="topbar-right">
        <div v-if="!backendConnected" class="preview-badge" title="请使用 npm run tauri dev 启动完整功能">浏览器预览</div>
        <label v-if="store.appSettings.showTopbarConcurrency" class="concurrency" title="全局最大并发解压任务数">
          并发
          <input v-model.number="store.maxConcurrency" type="range" min="1" max="8" />
          <b>{{ store.maxConcurrency }}</b>
        </label>
        <button v-if="store.appSettings.showExpandCollapseControl" class="btn btn-ghost" type="button" @click="store.toggleAllChannels(!allExpanded)">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 9l4-4 4 4M8 15l4 4 4-4" /></svg>
          {{ allExpanded ? '全部收起' : '全部展开' }}
        </button>
        <QuickSettings v-if="store.appSettings.showQuickSettings" />
        <button v-if="store.appSettings.showProjectCenterShortcut" class="btn btn-ghost task-center-trigger" type="button" title="项目中心（Ctrl+Shift+P）" @click="openProjectCenter">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" /><path d="M8 12h8M12 9v6" /></svg>
          项目
          <span v-if="projectCenter.pinnedCount" class="nav-count live">{{ projectCenter.pinnedCount }}</span>
          <span v-else-if="projectCenter.activeCount" class="nav-count">{{ projectCenter.activeCount }}</span>
        </button>
        <button v-if="store.appSettings.showTaskCenterShortcut" class="btn btn-ghost task-center-trigger" type="button" @click="openTaskCenter">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h10M4 18h7" /><circle cx="18" cy="15" r="3" /><path d="M18 13.5V15l1 1" /></svg>
          任务
          <span v-if="taskCenter.activeCount" class="nav-count live">{{ taskCenter.activeCount }}</span>
          <span v-else-if="taskCenter.failedCount" class="nav-count error">{{ taskCenter.failedCount }}</span>
        </button>
        <button v-if="store.appSettings.showLogsShortcut" class="btn btn-ghost" type="button" @click="openLogs">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
          日志
        </button>
        <button v-if="store.appSettings.showUndoShortcut" class="btn btn-ghost" type="button" :disabled="!history.canUndo || store.processingFiles > 0" :title="history.lastUndoLabel ? `撤销：${history.lastUndoLabel}（Ctrl/Cmd+Z）` : '没有可撤销操作'" @click="store.undoLastAction">↶ 撤销</button>
        <button v-if="store.appSettings.showRecentActionsShortcut" class="btn btn-ghost" type="button" title="最近操作与撤销记录" @click="openRecentActions">最近<span v-if="history.recentActions.length" class="nav-count">{{ history.recentActions.length }}</span></button>
        <button v-if="store.appSettings.showExtractionHistoryShortcut" class="btn btn-ghost" type="button" title="最近几次解压历史（可在设置中调整条数）" @click="openExtractionHistory">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 7v5l3 2" /><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.3" /><path d="M3.5 4v4.3h4.3" /></svg>
          解压历史<span v-if="taskCenter.finishedRecords.length" class="nav-count">{{ taskCenter.finishedRecords.length }}</span>
        </button>
        <button v-if="store.appSettings.showCommandPaletteShortcut" class="btn btn-ghost" type="button" title="全局命令搜索（Ctrl/Cmd+K）" @click="openCommandPalette">⌘ 命令</button>
        <button class="btn btn-ghost" type="button" @click="openSettings">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 00-1.88-.34 1.7 1.7 0 00-1.03 1.56V20h-3v-.08a1.7 1.7 0 00-1.03-1.56 1.7 1.7 0 00-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 007 15a1.7 1.7 0 00-1.56-1.03H5v-3h.44A1.7 1.7 0 007 9.94a1.7 1.7 0 00-.34-1.88L6.6 8l2.12-2.12.06.06a1.7 1.7 0 001.88.34A1.7 1.7 0 0011.7 4.7V4h3v.7a1.7 1.7 0 001.03 1.56 1.7 1.7 0 001.88-.34l.06-.06L19.8 8l-.06.06a1.7 1.7 0 00-.34 1.88A1.7 1.7 0 0021 10.97h.1v3H21A1.7 1.7 0 0019.4 15z" /></svg>
          设置
        </button>
        <button v-if="store.appSettings.showGlobalStartControl" class="btn btn-primary" type="button" :disabled="!store.hasStartableWork || store.processingFiles > 0 || store.inboxScanningIds.length > 0" :title="!store.hasRunnableFiles && store.hasAutoScannableChannels ? '没有待处理文件时，会先扫描关键词通道的最新版再自动开始' : '开始全部待处理任务'" @click="store.startAll">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 4l14 8-14 8V4z" /></svg>
          {{ !store.hasRunnableFiles && store.hasAutoScannableChannels ? '扫描并开始' : '全部开始' }}
        </button>
      </div>
    </header>

    <div class="workspace-toolbar" :class="{ sticky: store.appSettings.stickyToolbar }">
      <label v-if="store.appSettings.showWorkspaceSearch" class="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        <input ref="workspaceSearchInput" v-model="searchQuery" type="search" placeholder="搜索通道、备注、关键词或文件名" title="按 / 快速聚焦搜索" />
      </label>
      <select v-if="store.appSettings.showWorkspaceFilters" v-model="categoryFilter" class="toolbar-select" aria-label="筛选通道分类">
        <option value="all">全部分类</option>
        <option v-for="category in CHANNEL_CATEGORIES" :key="category.id" :value="category.id">{{ category.name }}</option>
      </select>
      <select v-if="store.appSettings.showWorkspaceFilters" v-model="statusFilter" class="toolbar-select" aria-label="筛选通道状态">
        <option value="all">全部状态</option>
        <option value="idle">待开始</option>
        <option value="queued">排队中</option>
        <option value="processing">处理中</option>
        <option value="paused">已暂停</option>
        <option value="done">已完成</option>
        <option value="error">有错误</option>
      </select>
      <span v-if="store.appSettings.showToolbarSummary" class="toolbar-summary">显示 {{ displayedChannels.length }}/{{ store.channels.length }} 个通道</span>
      <button v-if="hasActiveWorkspaceFilter" class="btn btn-ghost btn-sm workspace-filter-reset" type="button" title="清除搜索和筛选条件" @click="clearWorkspaceFilters">清除筛选</button>
      <div class="toolbar-actions">
        <button v-if="store.appSettings.showInboxScanControl" class="btn btn-ghost btn-sm inbox-scan-trigger" type="button" :disabled="keywordScanning || keywordChannelCount === 0" title="扫描全部已启用的关键词收件通道（Ctrl+Shift+F）" @click="store.scanAllKeywordChannels()">
          {{ keywordScanning ? `扫描中 ${store.inboxScanningIds.length}` : `扫描收件 ${keywordChannelCount || ''}` }}
        </button>
        <button v-if="store.appSettings.showWorkspaceCleanupControls && store.failedFiles" class="btn btn-ghost btn-sm" type="button" :disabled="store.processingFiles > 0" @click="store.startFailed">重试 {{ store.failedFiles }} 个失败</button>
        <button v-if="store.appSettings.showWorkspaceCleanupControls && store.completedFiles" class="btn btn-ghost btn-sm" type="button" @click="store.clearAllFinished">清理完成</button>
      </div>
      <span v-if="store.appSettings.showShortcutHints" class="shortcut-hint">Ctrl+K 命令 · / 搜索 · Ctrl+Z 撤销 · Ctrl+N 新建 · Ctrl+Shift+F 扫描 · Ctrl+Enter 全部开始</span>
    </div>

    <div v-if="store.appSettings.showRecoveryBanner && taskCenter.interruptedCount" class="recovery-banner">
      <div><b>发现 {{ taskCenter.interruptedCount }} 个上次未完成任务</b><span>可恢复 {{ taskCenter.recoverableRecords.length }} 个；密码不会被保存。</span></div>
      <div><button class="btn btn-sm" type="button" @click="openTaskCenter">查看详情</button><button class="btn btn-primary btn-sm" type="button" :disabled="!taskCenter.recoverableRecords.length || store.processingFiles > 0" @click="store.resumeInterruptedTasks(false)">恢复可恢复任务</button><button class="banner-close" type="button" title="隐藏恢复提示" @click="store.appSettings.showRecoveryBanner = false">×</button></div>
    </div>

    <main class="board">
      <div v-if="store.appSettings.showColumnHeaders" class="col-head" aria-hidden="true">
        <div class="ch-w-id">通道</div>
        <div class="ch-w-files">文件队列</div>
        <div class="ch-w-meter">进度</div>
        <div class="ch-w-actions">操作</div>
      </div>

      <template v-for="group in channelGroups" :key="group.id">
        <div v-if="store.appSettings.groupByCategory" class="channel-group-head">
          <span class="category-dot" :style="{ background: group.color }" />
          <b>{{ group.name }}</b>
          <span>{{ group.channels.length }} 个通道</span>
        </div>
        <ChannelCard v-for="channel in group.channels" :key="channel.id" :channel="channel" :index="originalIndex(channel)" />
      </template>

      <div v-if="displayedChannels.length === 0" class="filter-empty">
        <b>没有匹配的通道</b>
        <span>清除搜索词或筛选条件后再试。</span>
        <button class="btn btn-sm" type="button" @click="clearWorkspaceFilters">清除筛选</button>
      </div>

      <div v-if="store.appSettings.showAddChannelControl" class="add-channel-row">
        <select v-model="newChannelCategory" class="toolbar-select" aria-label="新通道分类">
          <option v-for="category in CHANNEL_CATEGORIES" :key="category.id" :value="category.id">{{ category.name }}</option>
        </select>
        <button class="add-channel" type="button" @click="createChannel">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14" /></svg>
          <span>新建{{ categoryMap.get(newChannelCategory)?.name }}通道</span>
        </button>
      </div>
    </main>

    <footer v-if="store.appSettings.showStatusBar" class="statusbar">
      <div class="statusbar-left">
        <span class="statusbar-item"><span class="dot" />{{ store.channels.length }} 个通道</span>
        <span class="statusbar-item">{{ store.totalFiles }} 个文件</span>
        <span class="statusbar-item">{{ projectCenter.projects.length }} 个项目</span>
        <span class="statusbar-item">{{ store.processingFiles }} 个活动任务</span>
        <span v-if="taskCenter.pausedCount" class="statusbar-item">{{ taskCenter.pausedCount }} 个暂停</span>
        <span class="statusbar-item success-text">{{ store.completedFiles }} 个完成</span>
        <span v-if="store.failedFiles" class="statusbar-item danger-text">{{ store.failedFiles }} 个失败</span>
      </div>
      <button class="statusbar-link" type="button" @click="openLogs">查看完整日志</button>
    </footer>

    <CommandPalette
      :open="commandPaletteOpen"
      @close="commandPaletteOpen = false"
      @open-settings="openSettings"
      @open-logs="openLogs"
      @open-tasks="openTaskCenter"
      @open-projects="openProjectCenter"
      @focus-workspace="focusWorkspaceSearch"
    />
    <RecentActionsDrawer />
    <ExtractionHistoryDrawer />
    <LogDrawer />
    <TaskCenterDrawer />
    <ProjectCenterDrawer />
    <SettingsDrawer />
    <StartReviewDialog />
    <ToastHost />
  </div>
</template>
