<script setup lang="ts">
import { computed } from 'vue';
import { useChannelStore } from '../stores/channels';
import type { Channel, ChannelAutomationProfile } from '../types';

const props = defineProps<{ channel: Channel }>();
const store = useChannelStore();

const activeProfile = computed<ChannelAutomationProfile>(() => {
  if (props.channel.inboxEnabled && props.channel.autoStartEnabled) return 'latest-auto';
  if (props.channel.inboxEnabled) return 'latest-manual';
  if (props.channel.autoStartEnabled) return 'import-auto';
  return 'manual';
});

const inboxReady = computed(() => Boolean(props.channel.inboxDirectory.trim() && props.channel.inboxKeywords.trim()));

const profiles: Array<{ id: ChannelAutomationProfile; title: string; description: string }> = [
  { id: 'manual', title: '纯手动', description: '只在你点击开始时运行，不自动收件。' },
  { id: 'import-auto', title: '导入即开始', description: '拖入或选择压缩包后立即开始当前新增任务。' },
  { id: 'latest-manual', title: '最新版按需', description: '启用关键词收件，需要时扫描最新版再手动开始。' },
  { id: 'latest-auto', title: '最新版自动', description: '空队列点开始时自动扫描最新版，并启用导入后自动开始。' },
];

function applyProfile(profile: ChannelAutomationProfile): void {
  store.applyChannelAutomationProfile(props.channel.id, profile);
}
</script>

<template>
  <section class="channel-automation-panel">
    <div class="channel-automation-head">
      <span><b>通道自动化方案</b><small>一键组合“关键词收件、导入自动开始、空队列扫描最新版”等行为。</small></span>
      <span class="automation-state enabled">{{ profiles.find((item) => item.id === activeProfile)?.title }}</span>
    </div>
    <div class="channel-automation-grid">
      <button
        v-for="profile in profiles"
        :key="profile.id"
        class="automation-profile-card"
        :class="{ active: activeProfile === profile.id }"
        type="button"
        @click="applyProfile(profile.id)"
      >
        <b>{{ profile.title }}</b>
        <small>{{ profile.description }}</small>
      </button>
    </div>
    <p v-if="(activeProfile === 'latest-manual' || activeProfile === 'latest-auto') && !inboxReady" class="automation-warning">
      还需要在“关键词收件”中配置收件目录和关键词，之后才能扫描最新版。
    </p>
  </section>
</template>
