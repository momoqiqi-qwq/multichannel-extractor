import { ref } from 'vue';
import { defineStore } from 'pinia';
import { DEFAULT_APP_SETTINGS } from '../config/appearance';
import { loadPersisted, loadPresets } from '../domain/state';
import type { AppSettings, ChannelPreset } from '../types';

export const useSettingsStore = defineStore('settings', () => {
  const persisted = loadPersisted();
  const appSettings = ref<AppSettings>(persisted?.appSettings ?? { ...DEFAULT_APP_SETTINGS });
  const maxConcurrency = ref(Math.min(8, Math.max(1, persisted?.maxConcurrency ?? 3)));
  const recentDestinations = ref<string[]>(persisted?.recentDestinations ?? []);
  const presets = ref<ChannelPreset[]>(loadPresets());
  const settingsOpen = ref(false);

  return {
    appSettings,
    maxConcurrency,
    recentDestinations,
    presets,
    settingsOpen,
  };
});
