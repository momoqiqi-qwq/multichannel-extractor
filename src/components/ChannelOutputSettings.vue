<script setup lang="ts">
import { useChannelStore } from '../stores/channels';
import type { Channel } from '../types';

const props = defineProps<{
  channel: Channel;
  destinationReady: boolean;
  outputSummary: string;
}>();
const store = useChannelStore();

function handleRecentDestination(event: Event): void {
  const target = event.target as HTMLSelectElement | null;
  if (target?.value) store.applyRecentDestination(props.channel.id, target.value);
  if (target) target.value = '';
}

function activateCustomDestination(): void {
  store.setDestinationMode(props.channel.id, 'custom');
}
</script>

<template>
  <div class="detail-block path-block">
    <div class="setting-label-row">
      <div class="setting-label">解压位置</div>
      <span v-if="!destinationReady" class="inline-error">需要选择目录</span>
    </div>
    <div class="output-mode-switch" role="group" aria-label="解压位置模式">
      <button type="button" :class="{ active: channel.useArchiveDirectory }" :aria-pressed="channel.useArchiveDirectory" @click="store.setDestinationMode(channel.id, 'archive')">跟随压缩包</button>
      <button type="button" :class="{ active: !channel.useArchiveDirectory }" :aria-pressed="!channel.useArchiveDirectory" @click="store.setDestinationMode(channel.id, 'custom')">指定目录</button>
    </div>
    <div class="setting-label sub-setting-label">输出容器</div>
    <div class="output-mode-switch output-container-switch" role="group" aria-label="输出容器模式">
      <button type="button" :class="{ active: !channel.createArchiveSubfolder }" :aria-pressed="!channel.createArchiveSubfolder" @click="store.setOutputContainer(channel.id, false)">直接写入</button>
      <button type="button" :class="{ active: channel.createArchiveSubfolder }" :aria-pressed="channel.createArchiveSubfolder" @click="store.setOutputContainer(channel.id, true)">压缩包同名文件夹</button>
    </div>
    <div class="layout-quick-actions">
      <button class="text-action" type="button" @click="store.applyDirectOverwriteProfile(channel.id)">一键直接覆盖</button>
      <button class="text-action" type="button" @click="store.applyIsolatedFolderProfile(channel.id)">一键独立文件夹</button>
    </div>
    <div class="path-row" :class="{ invalid: !destinationReady }">
      <input
        v-model="channel.destination"
        class="path-input"
        :aria-invalid="!destinationReady"
        placeholder="点击输入、粘贴路径，或使用右侧文件夹按钮"
        @focus="activateCustomDestination"
        @input="activateCustomDestination"
        @blur="store.commitDestination(channel.id)"
        @keydown.enter.prevent="store.commitDestination(channel.id)"
      />
      <button class="path-browse" type="button" title="选择解压文件夹" @click="store.browseDestination(channel.id)">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
      </button>
      <button v-if="channel.destination" class="path-browse path-clear" type="button" title="清空指定路径" @click="channel.destination = ''; store.setDestinationMode(channel.id, 'custom')">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
    <div class="path-tools">
      <select v-if="store.recentDestinations.length" class="mini-select" aria-label="最近使用的目录" @change="handleRecentDestination">
        <option value="">最近目录…</option>
        <option v-for="path in store.recentDestinations" :key="path" :value="path">{{ path }}</option>
      </select>
      <button class="text-action" type="button" :disabled="channel.files.length === 0" @click="store.useFirstFileDirectory(channel.id)">使用首个文件目录</button>
    </div>
    <div v-if="store.appSettings.showPathHints" class="output-preview" :class="{ warning: !destinationReady }">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
      <span>{{ outputSummary }}</span>
    </div>
  </div>
</template>
