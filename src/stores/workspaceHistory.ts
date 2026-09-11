import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { Channel, ChannelPreset } from '../types';

export interface WorkspaceActionRecord {
  id: string;
  label: string;
  at: string;
  undoable: boolean;
}

interface WorkspaceSnapshot {
  action: WorkspaceActionRecord;
  channels: Channel[];
  presets: ChannelPreset[];
}

function cloneChannels(channels: Channel[]): Channel[] {
  return channels.map((channel) => ({
    ...channel,
    password: '',
    dragActive: false,
    files: channel.files.map((file) => ({
      ...file,
      status: ['processing', 'queued', 'paused'].includes(file.status) ? 'cancelled' : file.status,
    })),
  }));
}

export const useWorkspaceHistoryStore = defineStore('workspace-history', () => {
  const recentActions = ref<WorkspaceActionRecord[]>([]);
  const undoStack = ref<WorkspaceSnapshot[]>([]);
  const drawerOpen = ref(false);
  const canUndo = computed(() => undoStack.value.length > 0);
  const lastUndoLabel = computed(() => undoStack.value.at(-1)?.action.label ?? '');

  function actionRecord(label: string, undoable: boolean): WorkspaceActionRecord {
    return {
      id: `history-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      label,
      at: new Date().toISOString(),
      undoable,
    };
  }

  function pushRecent(action: WorkspaceActionRecord): void {
    recentActions.value = [action, ...recentActions.value].slice(0, 30);
  }

  function capture(label: string, channels: Channel[], presets: ChannelPreset[] = []): void {
    const action = actionRecord(label, true);
    undoStack.value.push({ action, channels: cloneChannels(channels), presets: presets.map((preset) => ({ ...preset })) });
    if (undoStack.value.length > 15) undoStack.value.splice(0, undoStack.value.length - 15);
    pushRecent(action);
  }

  function note(label: string): void {
    pushRecent(actionRecord(label, false));
  }

  function undo(): { label: string; channels: Channel[]; presets: ChannelPreset[] } | null {
    const snapshot = undoStack.value.pop();
    if (!snapshot) return null;
    const label = snapshot.action.label;
    pushRecent(actionRecord(`撤销：${label}`, false));
    return { label, channels: cloneChannels(snapshot.channels), presets: snapshot.presets.map((preset) => ({ ...preset })) };
  }

  function clearRecent(): void {
    recentActions.value = [];
  }

  function clearUndo(): void {
    undoStack.value = [];
  }

  return {
    recentActions,
    drawerOpen,
    canUndo,
    lastUndoLabel,
    capture,
    note,
    undo,
    clearRecent,
    clearUndo,
  };
});
