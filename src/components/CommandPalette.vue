<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { SETTINGS_SEARCH_INDEX, normalizeSettingsSearchText } from '../config/settingsSearch';
import { useChannelStore } from '../stores/channels';
import { useWorkspaceHistoryStore } from '../stores/workspaceHistory';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
  close: [];
  openSettings: [];
  openLogs: [];
  openTasks: [];
  openProjects: [];
  focusWorkspace: [];
}>();

const store = useChannelStore();
const history = useWorkspaceHistoryStore();
const query = ref('');
const activeIndex = ref(0);
const input = ref<HTMLInputElement | null>(null);

interface PaletteCommand {
  id: string;
  label: string;
  description: string;
  group: string;
  aliases: string[];
  shortcut?: string;
  disabled?: boolean;
  run: () => void | Promise<void>;
}

const baseCommands = computed<PaletteCommand[]>(() => [
  { id: 'new-channel', label: '新建通道', description: '按默认分类创建一个新通道', group: '工作区', aliases: ['xjtd', 'new', 'channel'], shortcut: 'Ctrl+N', run: () => store.addChannel() },
  { id: 'start-all', label: '全部开始', description: '开始全部可运行任务；空队列可先扫描最新版', group: '任务', aliases: ['qbks', 'ks', 'start'], shortcut: 'Ctrl+Enter', disabled: !store.hasStartableWork || store.processingFiles > 0, run: () => store.startAll() },
  { id: 'scan-inbox', label: '扫描全部关键词收件', description: '扫描所有已配置的关键词通道', group: '任务', aliases: ['sm', 'sj', 'scan'], shortcut: 'Ctrl+Shift+F', disabled: store.inboxScanningIds.length > 0, run: () => store.scanAllKeywordChannels() },
  { id: 'undo', label: '撤销上一步', description: history.lastUndoLabel ? `撤销：${history.lastUndoLabel}` : '当前没有可撤销操作', group: '编辑', aliases: ['cx', 'undo', 'chexiao'], shortcut: 'Ctrl+Z', disabled: !history.canUndo || store.processingFiles > 0, run: () => store.undoLastAction() },
  { id: 'recent', label: '打开最近操作', description: '查看最近操作与撤销记录', group: '编辑', aliases: ['zjcz', 'history', 'recent'], run: () => { history.drawerOpen = true; } },
  { id: 'workspace-search', label: '聚焦工作区搜索', description: '搜索通道、备注、关键词和文件名', group: '导航', aliases: ['gzqss', 'ss', 'search'], shortcut: '/', run: () => emit('focusWorkspace') },
  { id: 'projects', label: '打开项目中心', description: '查看项目与固定项目', group: '导航', aliases: ['xm', 'project'], shortcut: 'Ctrl+Shift+P', run: () => emit('openProjects') },
  { id: 'tasks', label: '打开任务中心', description: '查看运行、失败与恢复任务', group: '导航', aliases: ['rw', 'task'], run: () => emit('openTasks') },
  { id: 'logs', label: '打开日志', description: '查看完整运行日志', group: '导航', aliases: ['rz', 'log'], run: () => emit('openLogs') },
  { id: 'settings', label: '打开总设置', description: '进入全部应用设置', group: '导航', aliases: ['sz', 'setting'], shortcut: 'Ctrl+,', run: () => emit('openSettings') },
  { id: 'clear-finished', label: '清理全部完成项', description: '从所有通道队列移除完成和取消项', group: '任务', aliases: ['ql', 'qk', 'clear'], disabled: store.completedFiles === 0, run: () => store.clearAllFinished() },
  { id: 'expand-all', label: '展开全部通道', description: '展开所有通道设置区域', group: '布局', aliases: ['zk', 'expand'], run: () => store.toggleAllChannels(true) },
  { id: 'collapse-all', label: '收起全部通道', description: '收起所有通道设置区域', group: '布局', aliases: ['sq', 'collapse'], run: () => store.toggleAllChannels(false) },
]);

const settingCommands = computed<PaletteCommand[]>(() => SETTINGS_SEARCH_INDEX.map((item) => ({
  id: `setting-${item.id}`,
  label: item.label,
  description: item.description,
  group: '设置',
  aliases: [...item.aliases, item.targetText ?? ''],
  run: () => {
    emit('openSettings');
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('jieyatai:open-setting', { detail: item })), 40);
  },
})));

const results = computed(() => {
  const source = [...baseCommands.value, ...settingCommands.value];
  const normalized = normalizeSettingsSearchText(query.value);
  if (!normalized) return source.slice(0, 16);
  return source
    .map((command) => {
      const label = normalizeSettingsSearchText(command.label);
      const aliases = command.aliases.map(normalizeSettingsSearchText);
      const description = normalizeSettingsSearchText(command.description);
      let score = 99;
      if (label === normalized || aliases.includes(normalized)) score = 0;
      else if (label.startsWith(normalized) || aliases.some((alias) => alias.startsWith(normalized))) score = 1;
      else if (label.includes(normalized) || aliases.some((alias) => alias.includes(normalized))) score = 2;
      else if (description.includes(normalized)) score = 3;
      return { command, score };
    })
    .filter((entry) => entry.score < 99)
    .sort((a, b) => a.score - b.score || a.command.label.localeCompare(b.command.label, 'zh-CN'))
    .slice(0, 18)
    .map((entry) => entry.command);
});

watch(() => props.open, async (open) => {
  if (!open) return;
  query.value = '';
  activeIndex.value = 0;
  await nextTick();
  input.value?.focus();
});
watch(query, () => { activeIndex.value = 0; });

function close(): void { emit('close'); }
async function run(command: PaletteCommand): Promise<void> {
  if (command.disabled) return;
  close();
  await command.run();
}
function move(offset: number): void {
  if (!results.value.length) return;
  activeIndex.value = (activeIndex.value + offset + results.value.length) % results.value.length;
}
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') { event.preventDefault(); close(); return; }
  if (event.key === 'ArrowDown') { event.preventDefault(); move(1); return; }
  if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); return; }
  if (event.key === 'Enter') {
    event.preventDefault();
    const command = results.value[activeIndex.value];
    if (command) void run(command);
  }
}
</script>

<template>
  <div v-if="open" class="command-palette-backdrop" role="presentation" @mousedown.self="close">
    <section class="command-palette" role="dialog" aria-modal="true" aria-label="全局命令搜索" @keydown="onKeydown">
      <label class="command-palette-search">
        <span>⌘</span>
        <input ref="input" v-model="query" type="search" placeholder="搜索命令、设置或缩写，例如 qd、bf、cx…" aria-label="搜索全局命令" />
        <kbd>Esc</kbd>
      </label>
      <div class="command-palette-list" role="listbox">
        <button
          v-for="(command, index) in results"
          :key="command.id"
          class="command-palette-item"
          :class="{ active: activeIndex === index }"
          type="button"
          :disabled="command.disabled"
          @mouseenter="activeIndex = index"
          @click="run(command)"
        >
          <span class="command-copy"><small>{{ command.group }}</small><b>{{ command.label }}</b><em>{{ command.description }}</em></span>
          <kbd v-if="command.shortcut">{{ command.shortcut }}</kbd>
        </button>
        <div v-if="!results.length" class="command-palette-empty">没有匹配命令。可以搜索中文、缩写或设置名称。</div>
      </div>
      <footer class="command-palette-footer"><span>↑↓ 选择</span><span>Enter 执行</span><span>Esc 关闭</span><span>设置也可以直接搜索</span></footer>
    </section>
  </div>
</template>
