<script setup lang="ts">
import { computed, ref } from 'vue';
import { categoryDefinition } from '../../config/appearance';
import { useChannelStore } from '../../stores/channels';

const store = useChannelStore();
const search = ref('');

const filteredChannels = computed(() => {
  const query = search.value.trim().toLocaleLowerCase();
  if (!query) return store.channels;
  return store.channels.filter((channel) =>
    `${channel.name} ${channel.destination} ${categoryDefinition(channel.category).name}`.toLocaleLowerCase().includes(query),
  );
});

const customCount = computed(() => store.channels.filter((channel) => !channel.useArchiveDirectory).length);
const missingCustomCount = computed(() => store.channels.filter((channel) => !channel.useArchiveDirectory && !channel.destination.trim()).length);

function useDefaultDestination(channelId: string): void {
  const path = store.appSettings.defaultDestination.trim();
  if (!path) {
    store.pushToast({ level: 'warn', title: '还没有默认解压地址', message: '请先到“输出默认值”中设置默认指定目录。' });
    return;
  }
  store.applyRecentDestination(channelId, path);
}

function handleRecentDestination(channelId: string, event: Event): void {
  const target = event.target as HTMLSelectElement;
  if (target.value) store.applyRecentDestination(channelId, target.value);
  target.value = '';
}

function fillMissingWithDefault(): void {
  const path = store.appSettings.defaultDestination.trim();
  if (!path) {
    store.pushToast({ level: 'warn', title: '还没有默认解压地址', message: '请先到“输出默认值”中设置默认指定目录。' });
    return;
  }
  let changed = 0;
  store.channels.forEach((channel) => {
    if (!channel.useArchiveDirectory && !channel.destination.trim()) {
      store.applyRecentDestination(channel.id, path);
      changed += 1;
    }
  });
  store.pushToast({ level: changed ? 'success' : 'info', title: changed ? '已补全空地址' : '没有需要补全的通道', message: changed ? `已为 ${changed} 个通道使用默认解压地址。` : '所有“指定目录”通道都已有地址。' });
}
</script>

<template>
  <section class="settings-section channel-destinations-section">
    <div class="settings-section-head">
      <div>
        <h3>通道解压地址</h3>
        <p>在一个页面集中查看和修改每个通道的解压位置，不需要逐个展开通道。</p>
      </div>
      <span class="settings-badge">{{ store.channels.length }} 个通道</span>
    </div>

    <div class="settings-detail-callout detailed-explanation">
      <b>地址模式说明</b>
      <span>“跟随压缩包”会把每个文件解压到它自身所在目录；“指定目录”会固定写入下面设置的路径。修改这里会立即同步到主界面的对应通道，并随工作区自动保存。</span>
    </div>

    <div class="channel-destination-toolbar">
      <label class="settings-search channel-destination-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        <input v-model="search" type="search" placeholder="搜索通道名称或解压地址" aria-label="搜索通道解压地址" />
      </label>
      <div class="channel-destination-summary">
        <span>指定目录 {{ customCount }}</span>
        <span v-if="missingCustomCount" class="danger-text">缺少地址 {{ missingCustomCount }}</span>
      </div>
      <button v-if="missingCustomCount" class="btn btn-ghost btn-sm" type="button" :disabled="!store.appSettings.defaultDestination" @click="fillMissingWithDefault">用默认地址补全</button>
    </div>
  </section>

  <section class="settings-section channel-destination-list-section">
    <div v-if="filteredChannels.length" class="channel-destination-list">
      <article v-for="channel in filteredChannels" :key="channel.id" class="channel-destination-card">
        <div class="channel-destination-head">
          <div class="channel-destination-title">
            <span class="category-dot" :style="{ background: channel.categoryColor }" />
            <span><b>{{ channel.name }}</b><small>{{ categoryDefinition(channel.category).name }}</small></span>
          </div>
          <span class="destination-mode-badge" :class="{ custom: !channel.useArchiveDirectory }">{{ channel.useArchiveDirectory ? '跟随压缩包' : '指定目录' }}</span>
        </div>

        <div class="output-mode-switch wide channel-destination-mode" role="group" :aria-label="`${channel.name} 解压地址模式`">
          <button type="button" :class="{ active: channel.useArchiveDirectory }" @click="store.setDestinationMode(channel.id, 'archive')">跟随压缩包</button>
          <button type="button" :class="{ active: !channel.useArchiveDirectory }" @click="store.setDestinationMode(channel.id, 'custom')">指定目录</button>
        </div>

        <div v-if="channel.useArchiveDirectory" class="channel-destination-follow-hint">
          <b>实际地址：</b><span>每个压缩包自身所在的文件夹</span>
          <small v-if="channel.destination">已保留上次指定地址：{{ channel.destination }}</small>
        </div>

        <template v-else>
          <div class="path-row" :class="{ invalid: !channel.destination.trim() }">
            <input
              v-model="channel.destination"
              class="path-input"
              :aria-invalid="!channel.destination.trim()"
              placeholder="输入或粘贴该通道的解压地址"
              @blur="store.commitDestination(channel.id)"
              @keydown.enter.prevent="store.commitDestination(channel.id)"
            />
            <button class="path-browse" type="button" title="选择解压文件夹" @click="store.browseDestination(channel.id)">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
            </button>
          </div>
          <div class="channel-destination-actions">
            <button class="text-action" type="button" :disabled="!store.appSettings.defaultDestination" @click="useDefaultDestination(channel.id)">使用默认地址</button>
            <select v-if="store.recentDestinations.length" class="mini-select" aria-label="使用最近地址" @change="handleRecentDestination(channel.id, $event)">
              <option value="">最近地址…</option>
              <option v-for="path in store.recentDestinations" :key="path" :value="path">{{ path }}</option>
            </select>
            <button class="text-action" type="button" :disabled="channel.files.length === 0" @click="store.useFirstFileDirectory(channel.id)">使用首个文件目录</button>
          </div>
          <p v-if="!channel.destination.trim()" class="channel-destination-error">指定目录模式必须填写地址，否则该通道开始前会提示选择目录。</p>
        </template>
      </article>
    </div>
    <div v-else class="settings-empty">没有匹配的通道或地址。<button v-if="search" class="text-action" type="button" @click="search = ''">清空搜索</button></div>
  </section>
</template>
