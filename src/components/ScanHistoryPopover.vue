<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useChannelStore } from '../stores/channels';
import type { Channel, ScanHistoryEntry } from '../types';

const props = defineProps<{ channel: Channel }>();
const store = useChannelStore();

const open = ref(false);
const detailsRef = ref<HTMLDetailsElement | null>(null);
const now = ref(Date.now());

const entries = computed<ScanHistoryEntry[]>(() =>
  [...props.channel.scanHistory].sort((a, b) => b.scannedAt.localeCompare(a.scannedAt)),
);
const count = computed(() => entries.value.length);

const formatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function relativeTime(iso: string): string {
  const diff = now.value - new Date(iso).getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return formatter.format(new Date(iso));
}

function toggle(): void {
  open.value = !open.value;
  if (open.value) now.value = Date.now();
}

function close(): void {
  open.value = false;
  detailsRef.value?.removeAttribute('open');
}

function busy(): boolean {
  return store.processingFiles > 0 || store.inboxScanningIds.includes(props.channel.id);
}

async function rescan(): Promise<void> {
  close();
  await store.rescanFromHistory(props.channel.id);
}

async function requeue(entry: ScanHistoryEntry): Promise<void> {
  close();
  await store.requeueFromHistory(props.channel.id, entry.id);
}

function removeEntry(entry: ScanHistoryEntry, event: Event): void {
  event.stopPropagation();
  store.removeScanHistoryEntry(props.channel.id, entry.id);
}

function clearAll(): void {
  if (window.confirm(`清空「${props.channel.name}」的全部 ${count.value} 条扫描历史？`)) {
    store.clearChannelScanHistory(props.channel.id);
  }
}

/** 点击组件外部时收起弹出层。 */
function onDocumentPointerDown(event: MouseEvent): void {
  if (!open.value) return;
  const root = detailsRef.value;
  if (root && event.target instanceof Node && !root.contains(event.target)) close();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) close();
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentPointerDown);
  document.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentPointerDown);
  document.removeEventListener('keydown', onKeydown);
});

/** 通道被删除或历史被清空后，弹层没有内容可展示时自动收起。 */
watch(count, (value) => {
  if (value === 0 && open.value) close();
});
</script>

<template>
  <details ref="detailsRef" class="scan-history" :open="open" @toggle="open = ($event.target as HTMLDetailsElement).open">
    <summary class="btn btn-ghost btn-sm scan-history-trigger" type="button" @click.prevent="toggle">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
      历史
      <span v-if="count" class="nav-count" :title="`共 ${count} 条扫描记录`">{{ count }}</span>
    </summary>
    <div v-if="open" class="scan-history-popover">
      <div class="scan-history-head">
        <div><b>扫描历史</b><span>该通道最近 {{ count }} 次关键词扫描</span></div>
        <button v-if="count" class="text-action" type="button" @click="clearAll">清空</button>
      </div>
      <div v-if="count" class="scan-history-list">
        <div v-for="entry in entries" :key="entry.id" class="scan-history-item" :title="entry.directory">
          <div class="scan-history-meta">
            <div>
              <b>{{ entry.selectedName || '（无选中）' }}</b>
              <small>{{ relativeTime(entry.scannedAt) }} · {{ entry.matchedFiles }} 个候选 · 扫描 {{ entry.scannedFiles }} 个</small>
            </div>
            <button class="text-action scan-history-remove" type="button" title="移除该条" @click="removeEntry(entry, $event)">×</button>
          </div>
          <div class="scan-history-foot">
            <code v-if="entry.keywords.length" class="scan-history-keywords">{{ entry.keywords.join(' / ') }}</code>
            <div class="scan-history-buttons">
              <button
                v-if="entry.selectedPath"
                class="btn btn-ghost btn-sm"
                type="button"
                :disabled="busy()"
                title="把当时选中的压缩包重新加入队列并开始"
                @click="requeue(entry)"
              >
                加入队列
              </button>
              <button class="btn btn-ghost btn-sm" type="button" :disabled="busy()" title="按通道当前关键词重新扫描收件目录" @click="rescan">重新扫描</button>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="scan-history-empty">
        <b>还没有扫描历史</b>
        <span>点击「扫描最新版并开始」后会自动记录本次结果。</span>
      </div>
    </div>
  </details>
</template>
