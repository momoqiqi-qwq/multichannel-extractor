<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { APP_RELEASE_NAME } from '../config/version';
import { normalizeSettingsSearchText, SETTINGS_TABS } from '../config/settingsSearch';
import type { SettingSearchItem, TabId } from '../config/settingsSearch';
import { useChannelStore } from '../stores/channels';
import GeneralSettings from './settings/GeneralSettings.vue';
import AppearanceSettings from './settings/AppearanceSettings.vue';
import BehaviorSettings from './settings/BehaviorSettings.vue';
import OutputSettings from './settings/OutputSettings.vue';
import ChannelDestinationsSettings from './settings/ChannelDestinationsSettings.vue';
import ReliabilitySettings from './settings/ReliabilitySettings.vue';
import RecoverySettings from './settings/RecoverySettings.vue';
import InboxSettings from './settings/InboxSettings.vue';
import DeveloperToolsSettings from './settings/DeveloperToolsSettings.vue';
import MaintenanceSettings from './settings/MaintenanceSettings.vue';
import AboutSettings from './settings/AboutSettings.vue';
import SettingsSidebar from './settings/SettingsSidebar.vue';

const store = useChannelStore();
const activeTab = ref<TabId>('general');
const settingsContent = ref<HTMLElement | null>(null);
const settingsSidebar = ref<{ focusSearch: () => void } | null>(null);
const locatedLabel = ref('');
let highlightTimer: number | undefined;


watch(() => store.settingsOpen, async (open) => {
  if (!open) return;
  await nextTick();
  settingsSidebar.value?.focusSearch();
});

function handleSettingsKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    settingsSidebar.value?.focusSearch();
  }
}

function selectTab(tab: TabId): void {
  activeTab.value = tab;
  locatedLabel.value = '';
}

function handleExternalSettingJump(event: Event): void {
  const item = (event as CustomEvent<SettingSearchItem>).detail;
  if (!item) return;
  store.settingsOpen = true;
  window.setTimeout(() => void jumpToSetting(item), 30);
}

onMounted(() => window.addEventListener('jieyatai:open-setting', handleExternalSettingJump));
onBeforeUnmount(() => window.removeEventListener('jieyatai:open-setting', handleExternalSettingJump));

async function jumpToSetting(item: SettingSearchItem): Promise<void> {
  activeTab.value = item.tab;
  await nextTick();
  const root = settingsContent.value;
  if (!root) return;
  const targetText = normalizeSettingsSearchText(item.targetText ?? item.label);
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(
    '.switch-row, .settings-field, .settings-profile-card, .theme-card, .maintenance-actions button, .settings-section-head button, .settings-panel, .settings-section, .channel-destination-card',
  ));
  const target = candidates
    .filter((element) => normalizeSettingsSearchText(element.textContent ?? '').includes(targetText))
    .sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0))[0];
  if (!target) {
    locatedLabel.value = `已打开“${SETTINGS_TABS.find((tab) => tab.id === item.tab)?.label ?? ''}”，未找到可定位控件`;
    return;
  }
  root.querySelectorAll('.settings-search-target').forEach((element) => element.classList.remove('settings-search-target'));
  window.clearTimeout(highlightTimer);
  target.classList.add('settings-search-target');
  target.scrollIntoView({ behavior: store.appSettings.reduceMotion ? 'auto' : 'smooth', block: 'center' });
  const control = target.matches('button, input, select, textarea') ? target : target.querySelector<HTMLElement>('input, select, textarea, button');
  control?.focus({ preventScroll: true });
  locatedLabel.value = `已定位：${item.label}`;
  highlightTimer = window.setTimeout(() => target.classList.remove('settings-search-target'), 2200);
}
</script>

<template>
  <div v-if="store.settingsOpen" class="drawer-backdrop" role="presentation" @mousedown.self="store.settingsOpen = false">
    <aside class="settings-drawer settings-drawer-v7" :class="{ compact: store.appSettings.settingsSidebarCompact }" role="dialog" aria-modal="true" aria-labelledby="settings-title" @keydown="handleSettingsKeydown">
      <header class="drawer-head">
        <div><div class="settings-title-row"><h2 id="settings-title">总设置</h2><span class="version-chip">{{ APP_RELEASE_NAME }}</span></div><p>自检、恢复、输出、界面与项目工具</p></div>
        <button class="btn btn-ghost btn-sm" type="button" @click="store.settingsOpen = false">关闭</button>
      </header>
      <div class="settings-layout-v7">
        <SettingsSidebar ref="settingsSidebar" :active-tab="activeTab" @select-tab="selectTab" @jump="jumpToSetting" />
        <div ref="settingsContent" class="settings-scroll settings-content-v7">
          <div v-if="locatedLabel" class="settings-located-banner">{{ locatedLabel }}</div>
          <GeneralSettings v-if="activeTab === 'general'" />
          <AppearanceSettings v-else-if="activeTab === 'appearance'" />
          <BehaviorSettings v-else-if="activeTab === 'behavior'" />
          <OutputSettings v-else-if="activeTab === 'output'" />
          <ChannelDestinationsSettings v-else-if="activeTab === 'destinations'" />
          <InboxSettings v-else-if="activeTab === 'inbox'" />
          <ReliabilitySettings v-else-if="activeTab === 'reliability'" />
          <RecoverySettings v-else-if="activeTab === 'recovery'" />
          <DeveloperToolsSettings v-else-if="activeTab === 'developer'" />
          <MaintenanceSettings v-else-if="activeTab === 'maintenance'" />
          <AboutSettings v-else />
        </div>
      </div>
    </aside>
  </div>
</template>
