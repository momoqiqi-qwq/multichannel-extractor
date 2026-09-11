<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { APP_RELEASE_NAME } from '../../config/version';
import { SETTINGS_TABS, normalizeSettingsSearchText, searchSettings } from '../../config/settingsSearch';
import type { SettingSearchItem, TabId } from '../../config/settingsSearch';
import { useChannelStore } from '../../stores/channels';

const props = defineProps<{ activeTab: TabId }>();
const emit = defineEmits<{ selectTab: [tab: TabId]; jump: [item: SettingSearchItem] }>();
const store = useChannelStore();
const search = ref('');
const searchInput = ref<HTMLInputElement | null>(null);
const activeResultIndex = ref(0);
const results = computed(() => searchSettings(search.value));
const visibleTabs = computed(() => {
  const query = normalizeSettingsSearchText(search.value);
  if (!query) return SETTINGS_TABS;
  const resultTabs = new Set(results.value.map((item) => item.tab));
  return SETTINGS_TABS.filter((tab) => normalizeSettingsSearchText(`${tab.label} ${tab.keywords}`).includes(query) || resultTabs.has(tab.id));
});

watch(search, () => { activeResultIndex.value = 0; });
watch(results, (items) => {
  if (!items.length) activeResultIndex.value = 0;
  else activeResultIndex.value = Math.min(activeResultIndex.value, items.length - 1);
});

function selectTab(tab: TabId): void { search.value = ''; emit('selectTab', tab); }
function clearSearch(): void { search.value = ''; void nextTick(() => searchInput.value?.focus()); }
function jump(item: SettingSearchItem): void { search.value = ''; emit('jump', item); }
function jumpFirst(): void {
  const first = results.value[activeResultIndex.value] ?? results.value[0];
  if (first) jump(first);
  else if (visibleTabs.value[0]) selectTab(visibleTabs.value[0].id);
}
function moveResult(offset: number): void {
  if (!results.value.length) return;
  activeResultIndex.value = (activeResultIndex.value + offset + results.value.length) % results.value.length;
  void nextTick(() => document.getElementById(`settings-search-result-${activeResultIndex.value}`)?.scrollIntoView({ block: 'nearest' }));
}
function handleSearchKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') { event.preventDefault(); moveResult(1); return; }
  if (event.key === 'ArrowUp') { event.preventDefault(); moveResult(-1); return; }
  if (event.key === 'Enter') { event.preventDefault(); jumpFirst(); return; }
  if (event.key === 'Escape' && search.value) { event.preventDefault(); event.stopPropagation(); clearSearch(); }
}
function focusSearch(): void { void nextTick(() => searchInput.value?.focus()); }

defineExpose({ focusSearch });
</script>

<template>
  <aside class="settings-sidebar-v7">
    <div class="settings-search-wrap">
      <label class="settings-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        <input
          ref="searchInput"
          v-model="search"
          type="search"
          placeholder="搜索设置 / 缩写，如 qd、bf、gjl"
          aria-label="搜索设置，支持中文、缩写和英文"
          :aria-activedescendant="results.length ? `settings-search-result-${activeResultIndex}` : undefined"
          @keydown="handleSearchKeydown"
        />
        <button v-if="search" class="settings-search-clear" type="button" title="清空搜索（Esc）" aria-label="清空设置搜索" @click="clearSearch">×</button>
      </label>
      <div v-if="search" class="settings-search-results" role="listbox" aria-label="设置搜索结果">
        <div class="settings-search-status">
          <span>{{ results.length ? `找到 ${results.length} 项` : '没有直接结果' }}</span>
          <span>↑↓ 选择 · Enter 直达 · Esc 清空</span>
        </div>
        <button
          v-for="(item, index) in results"
          :id="`settings-search-result-${index}`"
          :key="item.id"
          class="settings-search-result"
          :class="{ active: index === activeResultIndex }"
          type="button"
          role="option"
          :aria-selected="index === activeResultIndex"
          @mouseenter="activeResultIndex = index"
          @focus="activeResultIndex = index"
          @click="jump(item)"
        >
          <span><b>{{ item.label }}</b><small>{{ item.description }}</small></span>
          <em>{{ SETTINGS_TABS.find((tab) => tab.id === item.tab)?.label }}</em>
        </button>
        <div v-if="results.length === 0" class="settings-search-empty">没有匹配的具体设置。可尝试中文名称、拼音首字母、常用缩写或英文关键词。</div>
        <p class="settings-search-tip">缩写示例：<code>qd</code> 启动 · <code>bf</code> 并发 · <code>gjl</code> 工具栏 · <code>rz</code> 日志 · 回车直达首项</p>
      </div>
    </div>

    <nav class="settings-nav-v7" aria-label="设置分类">
      <button v-for="tab in visibleTabs" :key="tab.id" type="button" :class="{ active: props.activeTab === tab.id }" :title="tab.label" @click="selectTab(tab.id)">
        <span class="settings-nav-icon">{{ tab.icon }}</span><span>{{ tab.label }}</span>
      </button>
    </nav>
    <div v-if="visibleTabs.length === 0" class="settings-nav-empty">没有匹配的设置分类</div>
    <footer class="settings-sidebar-footer">
      <label class="switch-row compact-switch"><span><b>紧凑侧栏</b></span><input v-model="store.appSettings.settingsSidebarCompact" type="checkbox" /></label>
      <span>解压台 · {{ APP_RELEASE_NAME }}</span>
    </footer>
  </aside>
</template>
