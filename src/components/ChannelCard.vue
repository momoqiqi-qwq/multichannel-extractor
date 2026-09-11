<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import ChannelFileQueue from './ChannelFileQueue.vue';
import ChannelOutputSettings from './ChannelOutputSettings.vue';
import ChannelDepthSettings from './ChannelDepthSettings.vue';
import ChannelInboxSettings from './ChannelInboxSettings.vue';
import ChannelProjectTools from './ChannelProjectTools.vue';
import ChannelAutomationSettings from './ChannelAutomationSettings.vue';
import { CHANNEL_CATEGORIES, categoryDefinition } from '../config/appearance';
import { useChannelStore } from '../stores/channels';
import { displayPath } from '../utils/path';
import { depthModeDescription, outputContainerDescription, outputLayoutExample } from '../domain/outputLayout';
import type { Channel, ChannelCategory } from '../types';

const props = defineProps<{ channel: Channel; index: number }>();
const store = useChannelStore();
const renaming = ref(false);
const draftName = ref(props.channel.name);
const renameInput = ref<HTMLInputElement | null>(null);
const selectedPresetName = ref('');

const status = computed(() => store.channelStatus(props.channel));
const progress = computed(() => store.channelProgress(props.channel));
const isBusy = computed(() => props.channel.files.some((file) => ['queued', 'processing', 'paused'].includes(file.status)));
const runnableCount = computed(() =>
  props.channel.files.filter((file) => file.supported && ['pending', 'error', 'cancelled'].includes(file.status)).length,
);
const completedCount = computed(() => props.channel.files.filter((file) => file.status === 'success').length);
const category = computed(() => categoryDefinition(props.channel.category));
const manualOrderEnabled = computed(() => store.appSettings.channelSort === 'manual');
const destinationReady = computed(() => props.channel.useArchiveDirectory || Boolean(props.channel.destination.trim()));
const canScanLatest = computed(() => store.canScanLatest(props.channel));
const canAutoScanLatest = computed(() => store.appSettings.scanLatestOnEmptyStart && canScanLatest.value);
const isScanningInbox = computed(() => store.inboxScanningIds.includes(props.channel.id));

const statusText = computed(() => {
  if (status.value === 'processing') return `解压中 · ${progress.value}%`;
  if (status.value === 'queued') return '排队中';
  if (status.value === 'paused') return `已暂停 · ${progress.value}%`;
  if (status.value === 'done') return '全部完成';
  if (status.value === 'error') return `${props.channel.files.filter((file) => file.status === 'error').length} 个失败`;
  if (runnableCount.value === 0 && canScanLatest.value) return '可扫描最新版';
  return '待开始';
});

const layerCaption = computed(() => depthModeDescription(props.channel.depthMode, props.channel.depth));
const layoutExample = computed(() => outputLayoutExample(props.channel));
const containerDescription = computed(() => outputContainerDescription(props.channel));
const depthBadge = computed(() => {
  if (props.channel.depthMode === 'preserve') return '保留结构';
  if (props.channel.depthMode === 'skipOuter') return '跳过外层';
  return props.channel.depth <= 0 ? '完全展平' : `保留 ${props.channel.depth} 层`;
});

const outputSummary = computed(() => {
  const suffix = props.channel.createArchiveSubfolder ? '；输出容器：压缩包同名文件夹' : '；输出容器：直接写入';
  if (props.channel.useArchiveDirectory) return `每个压缩包使用其所在目录${suffix}`;
  if (!props.channel.destination.trim()) return '尚未设置指定目录，点击路径框即可输入或选择';
  return `${displayPath(props.channel.destination)}${suffix}`;
});

function beginRename(): void {
  draftName.value = props.channel.name;
  renaming.value = true;
  void nextTick(() => {
    renameInput.value?.focus();
    renameInput.value?.select();
  });
}

function commitRename(): void {
  if (!renaming.value) return;
  const previous = props.channel.name;
  renaming.value = false;
  store.renameChannel(props.channel.id, draftName.value, previous);
}

function cancelRename(): void {
  draftName.value = props.channel.name;
  renaming.value = false;
}

function handlePresetChange(event: Event): void {
  const target = event.target as HTMLSelectElement | null;
  selectedPresetName.value = target?.value ?? '';
  if (selectedPresetName.value) store.applyPreset(props.channel.id, selectedPresetName.value);
}

function deleteSelectedPreset(): void {
  if (!selectedPresetName.value) return;
  if (store.deletePreset(selectedPresetName.value)) selectedPresetName.value = '';
}

function handleCategoryChange(event: Event): void {
  const target = event.target as HTMLSelectElement | null;
  if (target?.value) store.updateChannelCategory(props.channel.id, target.value as ChannelCategory);
}



function removeChannel(): void {
  if (store.appSettings.confirmBeforeDelete && (isBusy.value || props.channel.files.length > 0)) {
    const accepted = window.confirm(`确定删除“${props.channel.name}”吗？正在处理的任务会被取消。`);
    if (!accepted) return;
  }
  store.removeChannel(props.channel.id);
}

function applySettingsToAll(): void {
  const accepted = window.confirm(`将“${props.channel.name}”的输出位置、层级、自动开始、Claude 自动启动、冲突策略和高级选项应用到其他通道吗？`);
  if (accepted) store.applyChannelSettingsToAll(props.channel.id);
}

function handleNativeDragEnter(event: DragEvent): void {
  event.preventDefault();
  store.setDragActive(props.channel.id, true);
}

function handleNativeDragLeave(event: DragEvent): void {
  const current = event.currentTarget as HTMLElement;
  const related = event.relatedTarget as Node | null;
  if (!related || !current.contains(related)) store.setDragActive(props.channel.id, false);
}

function handleNativeDrop(event: DragEvent): void {
  event.preventDefault();
  store.setDragActive(props.channel.id, false);
}
</script>

<template>
  <section
    class="channel"
    :class="{ expanded: channel.expanded, drag: channel.dragActive, 'destination-missing': !destinationReady }"
    :data-state="status"
    :data-channel-id="channel.id"
    :style="{ '--channel-color': channel.categoryColor }"
    @dragenter="handleNativeDragEnter"
    @dragover.prevent
    @dragleave="handleNativeDragLeave"
    @drop="handleNativeDrop"
  >
    <div class="drag-hint" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 4v12M6 10l6 6 6-6M5 20h14" /></svg>
      松开鼠标导入到「{{ channel.name }}」
    </div>

    <div v-if="store.appSettings.showChannelOrderControls || store.appSettings.showChannelDuplicateControl || store.appSettings.showChannelDeleteControl" class="channel-tools">
      <button v-if="store.appSettings.showChannelOrderControls" class="icon-btn" type="button" title="上移通道" :disabled="!manualOrderEnabled || index === 0" @click="store.moveChannel(channel.id, -1)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 14l5-5 5 5" /></svg>
      </button>
      <button v-if="store.appSettings.showChannelOrderControls" class="icon-btn" type="button" title="下移通道" :disabled="!manualOrderEnabled || index === store.channels.length - 1" @click="store.moveChannel(channel.id, 1)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 10l5 5 5-5" /></svg>
      </button>
      <button v-if="store.appSettings.showChannelDuplicateControl" class="icon-btn" type="button" title="复制通道配置" @click="store.duplicateChannel(channel.id)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2h3" /></svg>
      </button>
      <button v-if="store.appSettings.showChannelDeleteControl" class="icon-btn danger-hover" type="button" aria-label="删除通道" title="删除该通道" @click="removeChannel">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>

    <div class="channel-row">
      <div class="cell-id">
        <div v-if="store.appSettings.showChannelNumbers" class="channel-id">CH {{ String(index + 1).padStart(2, '0') }}</div>
        <div class="channel-title-row">
          <input
            v-if="renaming"
            ref="renameInput"
            v-model="draftName"
            class="channel-name channel-name-edit"
            aria-label="编辑通道名称"
            maxlength="80"
            @blur="commitRename"
            @keydown.enter.prevent="commitRename"
            @keydown.esc.prevent="cancelRename"
          />
          <button v-else class="channel-name-button" type="button" title="双击或点击铅笔重命名" @dblclick="beginRename">
            {{ channel.name }}
          </button>
          <button class="rename-button" type="button" title="重命名通道" @click="beginRename">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h4l11-11-4-4L4 16v4zM13.5 6.5l4 4" /></svg>
          </button>
        </div>
        <div class="channel-badges">
          <span class="category-pill"><i :style="{ background: channel.categoryColor }" />{{ category.name }}</span>
          <span class="status-pill" :class="`status-${status}`">{{ statusText }}</span>
          <span class="layout-pill" :title="containerDescription">{{ channel.createArchiveSubfolder ? '同名文件夹' : '直接写入' }}</span>
          <span class="layout-pill" :title="layerCaption">{{ depthBadge }}</span>
          <span v-if="channel.collisionPolicy === 'overwrite'" class="layout-pill overwrite-pill" title="目标中存在同名文件时直接替换">替换同名</span>
          <span v-if="channel.inboxEnabled" class="layout-pill inbox-pill" title="已启用下载目录关键词筛选">关键词收件</span>
          <span v-if="channel.inboxKeywords.trim()" class="layout-pill route-pill" title="拖到 EXE 或工作区空白处时可按这些关键词自动进入此通道">关键词路由</span>
          <span v-if="channel.autoStartEnabled" class="layout-pill auto-start-pill" title="新文件导入此通道后会自动开始">自动开始</span>
          <span v-if="!destinationReady" class="status-pill status-error">缺少目录</span>
        </div>
      </div>

      <div class="cell-sep" />

      <ChannelFileQueue :channel="channel" />

      <div class="cell-sep" />

      <div class="cell-meter">
        <div class="meter" :aria-label="`通道进度 ${progress}%`">
          <div v-for="segment in 10" :key="segment" class="meter-seg" :class="{ on: segment * 10 <= progress, warn: status === 'processing' && segment * 10 > Math.max(0, progress - 10), err: status === 'error' && segment * 10 <= progress }" />
        </div>
        <div class="foot-stat">{{ channel.files.length === 0 && canScanLatest ? '未导入 · 可直接扫描最新版' : `${completedCount}/${channel.files.length} 完成 · ${progress}%` }}</div>
      </div>

      <div class="cell-sep" />

      <div class="cell-actions">
        <button class="btn btn-ghost btn-sm" type="button" title="添加文件" @click="store.browseFiles(channel.id)">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14" /></svg>文件
        </button>
        <button class="expand-toggle" type="button" @click="channel.expanded = !channel.expanded">设置<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9l6 6 6-6" /></svg></button>
        <template v-if="isBusy">
          <button v-if="store.appSettings.enablePauseResume && status !== 'paused'" class="btn btn-sm" type="button" title="暂停该通道中的运行与排队任务" @click="store.pauseChannel(channel.id)">暂停</button>
          <button v-if="status === 'paused'" class="btn btn-primary btn-sm" type="button" title="继续该通道中的暂停任务" @click="store.resumeChannel(channel.id)">继续</button>
          <button class="btn btn-sm" type="button" @click="store.cancelChannel(channel.id)">取消</button>
        </template>
        <template v-else-if="status === 'done'">
          <button class="btn btn-ghost btn-sm" type="button" :disabled="!channel.destination && !channel.files.some((file) => file.outputPath)" @click="store.openChannelOutput(channel.id)">打开</button>
          <button
            v-if="canScanLatest"
            class="btn btn-primary btn-sm"
            type="button"
            :disabled="isScanningInbox || !destinationReady"
            title="扫描关键词收件目录，重新选择当前最新版并立即开始"
            @click="store.scanLatestAndStartChannel(channel.id)"
          >
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 4l14 8-14 8V4z" /></svg>{{ isScanningInbox ? '扫描中…' : '扫描最新版并开始' }}
          </button>
          <button v-else class="btn btn-primary btn-sm" type="button" :disabled="!destinationReady" title="按当前输出容器和层级重新解压" @click="store.rerunChannel(channel.id)">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 7v5h-5" /><path d="M19 12a7 7 0 10-2 5" /></svg>重新解压
          </button>
        </template>
        <button v-else class="btn btn-primary btn-sm" type="button" :disabled="isScanningInbox || (runnableCount === 0 && !canAutoScanLatest) || !destinationReady" :title="runnableCount === 0 && canAutoScanLatest ? '队列为空时自动扫描关键词收件目录，选择最新版并开始' : (runnableCount === 0 && canScanLatest ? '空队列自动扫描已关闭，可在总设置开启' : '开始当前待处理任务')" @click="store.startChannel(channel.id)">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 4l14 8-14 8V4z" /></svg>{{ isScanningInbox ? '扫描中…' : (runnableCount === 0 && canAutoScanLatest ? '扫描最新版并开始' : '开始') }}
        </button>
      </div>
    </div>

    <div class="channel-detail">
      <div class="channel-detail-inner">
        <div class="detail-row">
          <ChannelOutputSettings
            :channel="channel"
            :destination-ready="destinationReady"
            :output-summary="outputSummary"
          />

          <ChannelDepthSettings
            :channel="channel"
            :layer-caption="layerCaption"
            :layout-example="layoutExample"
            :container-description="containerDescription"
          />

          <div class="detail-block category-block">
            <div class="setting-label">分类与标识</div>
            <div class="category-editor">
              <select class="option-input" :value="channel.category" aria-label="通道分类" @change="handleCategoryChange">
                <option v-for="item in CHANNEL_CATEGORIES" :key="item.id" :value="item.id">{{ item.name }}</option>
              </select>
              <label class="color-field" title="自定义通道左侧颜色"><input v-model="channel.categoryColor" type="color" /><span>颜色</span></label>
            </div>
            <input v-model.trim="channel.note" class="option-input note-input" maxlength="120" placeholder="通道备注，可用于搜索" />
            <div class="layer-caption">{{ category.description }}</div>
          </div>
        </div>

        <div class="channel-auto-start-card">
          <label class="switch-row compact-switch">
            <span><b>导入后自动开始</b><small>拖入、文件选择或关键词收件加入的新压缩包，会只启动本次新增任务</small></span>
            <input v-model="channel.autoStartEnabled" type="checkbox" />
          </label>
          <span class="automation-state" :class="{ enabled: channel.autoStartEnabled }">{{ channel.autoStartEnabled ? '已启用' : '手动开始' }}</span>
        </div>

        <ChannelAutomationSettings v-if="store.appSettings.showChannelAutomationControls" :channel="channel" />

        <div v-if="completedCount > 0" class="rerun-notice">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
          <span>层级、输出容器或重名策略的修改只影响下一次解压。点击“重新解压”应用当前设置；之前生成的旧文件夹不会自动删除。</span>
        </div>

        <ChannelInboxSettings :channel="channel" />

        <div class="advanced-toggle-row">
          <button class="advanced-toggle" type="button" @click="channel.advancedOpen = !channel.advancedOpen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" /><path d="M19 12a7 7 0 01-.12 1.3l2 1.55-2 3.46-2.47-1a7.4 7.4 0 01-2.25 1.3L13.8 21h-4l-.36-2.39a7.4 7.4 0 01-2.25-1.3l-2.47 1-2-3.46 2-1.55A7 7 0 014.6 12a7 7 0 01.12-1.3l-2-1.55 2-3.46 2.47 1a7.4 7.4 0 012.25-1.3L9.8 3h4l.36 2.39a7.4 7.4 0 012.25 1.3l2.47-1 2 3.46-2 1.55A7 7 0 0119 12z" /></svg>
            {{ channel.advancedOpen ? '收起高级设置' : '更多设置' }}
            <span>重名策略、根目录去重、系统垃圾过滤、空目录、密码与队列排序</span>
          </button>
        </div>

        <div v-if="channel.advancedOpen" class="advanced-grid">
          <label class="settings-field">
            <span>重名文件处理</span>
            <select v-model="channel.collisionPolicy" class="option-input">
              <option value="overwrite">直接替换已有文件（默认）</option>
              <option value="rename">保留两份并自动重命名</option>
              <option value="skip">保留已有文件并跳过</option>
            </select>
          </label>
          <label class="settings-field">
            <span>文件队列排序</span>
            <select v-model="channel.fileSort" class="option-input">
              <option value="manual">导入顺序</option>
              <option value="name">按名称</option>
              <option value="size">按大小</option>
              <option value="status">按状态</option>
            </select>
          </label>
          <label class="settings-field">
            <span>解压密码</span>
            <input v-model="channel.password" class="option-input" type="password" autocomplete="off" placeholder="可选，不会持久化保存" />
          </label>
          <div class="advanced-switches">
            <label class="switch-row compact-switch"><span><b>避免同名根目录重复嵌套</b><small>例如输出容器和归档根目录都叫 package 时，只保留一层</small></span><input v-model="channel.deduplicateArchiveRoot" type="checkbox" /></label>
            <label class="switch-row compact-switch"><span><b>过滤系统垃圾文件</b><small>跳过 __MACOSX、.DS_Store、Thumbs.db 等元数据</small></span><input v-model="channel.skipJunkFiles" type="checkbox" /></label>
            <label class="switch-row compact-switch"><span><b>保留空目录</b><small>即使目录中没有文件，也保留其层级结构</small></span><input v-model="channel.keepEmptyDirectories" type="checkbox" /></label>
            <label class="switch-row compact-switch"><span><b>完成后打开目标文件夹</b><small>每个任务结束后打开输出位置</small></span><input v-model="channel.openAfter" type="checkbox" /></label>
          </div>
        </div>

        <ChannelProjectTools :channel="channel" />

        <div class="detail-footer">
          <div class="preset-inline">
            <span class="setting-label">通道预设</span>
            <select v-model="selectedPresetName" class="option-input" aria-label="应用或删除通道预设" @change="handlePresetChange">
              <option value="">选择预设…</option>
              <option v-for="preset in store.presets" :key="preset.name" :value="preset.name">{{ preset.name }}</option>
            </select>
            <button class="btn btn-sm" type="button" @click="store.savePreset(channel.id)">保存当前预设</button>
            <button class="btn btn-ghost btn-sm preset-delete-button" type="button" :disabled="!selectedPresetName" title="删除当前选中的已保存预设" @click="deleteSelectedPreset">删除已选预设</button>
          </div>
          <div class="detail-actions">
            <button class="btn btn-ghost btn-sm" type="button" @click="store.resetChannelSettings(channel.id)">恢复默认</button>
            <button class="btn btn-ghost btn-sm" type="button" @click="store.duplicateChannel(channel.id)">复制通道</button>
            <button class="btn btn-ghost btn-sm" type="button" :disabled="store.channels.length < 2" @click="applySettingsToAll">应用到全部</button>
            <button class="btn btn-ghost btn-sm" type="button" :disabled="channel.files.length === 0 || isBusy" @click="store.clearPending(channel.id)">清空队列</button>
            <button class="btn btn-ghost btn-sm" type="button" :disabled="!channel.files.some((file) => ['success', 'cancelled'].includes(file.status))" @click="store.clearFinished(channel.id)">清理完成项</button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
