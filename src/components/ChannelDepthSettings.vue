<script setup lang="ts">
import { useChannelStore } from '../stores/channels';
import type { Channel } from '../types';

const props = defineProps<{
  channel: Channel;
  layerCaption: string;
  layoutExample: string;
  containerDescription: string;
}>();
const store = useChannelStore();
</script>

<template>
  <div class="detail-block depth-block">
    <div class="setting-label">解压层级</div>
    <div class="depth-modes">
      <button class="depth-mode-btn" :class="{ active: channel.depthMode === 'preserve' }" type="button" @click="store.setDepthMode(channel.id, 'preserve')">保留结构</button>
      <button class="depth-mode-btn" :class="{ active: channel.depthMode === 'flatten' }" type="button" @click="store.setDepthMode(channel.id, 'flatten')">展平层级</button>
      <button class="depth-mode-btn" :class="{ active: channel.depthMode === 'skipOuter' }" type="button" @click="store.setDepthMode(channel.id, 'skipOuter')">跳过外层</button>
    </div>
    <div v-if="channel.depthMode === 'flatten'" class="depth-editor">
      <label>保留深度<input v-model.number="channel.depth" type="number" min="0" max="32" step="1" /></label>
      <div class="depth-presets" aria-label="常用保留深度">
        <button v-for="depth in [0, 1, 2, 3]" :key="depth" type="button" :class="{ active: channel.depth === depth }" @click="channel.depth = depth">{{ depth === 0 ? '完全展平' : `${depth} 层` }}</button>
      </div>
      <div class="layer-stack" aria-hidden="true">
        <button v-for="layer in 5" :key="layer" class="layer-block" :class="layer <= channel.depth ? 'kept' : 'flattened'" type="button" @click="channel.depth = layer"><span>{{ layer }}</span></button>
      </div>
    </div>
    <div class="layer-caption">{{ layerCaption }}</div>
    <div v-if="store.appSettings.showLayoutExamples" class="layout-example">
      <span>示例输出</span>
      <code>{{ layoutExample }}</code>
      <small>{{ containerDescription }}</small>
    </div>
  </div>
</template>
