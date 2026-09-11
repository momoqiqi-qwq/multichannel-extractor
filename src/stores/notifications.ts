import { ref } from 'vue';
import { defineStore } from 'pinia';
import { chooseLogPath, writeLogFile } from '../services/tauri';
import { createId } from '../domain/state';
import type { LogEntry, ToastMessage } from '../types';

export const useNotificationStore = defineStore('notifications', () => {
  const logs = ref<LogEntry[]>([]);
  const toasts = ref<ToastMessage[]>([]);
  const logDrawerOpen = ref(false);
  const retention = ref(2000);

  function setRetention(value: number): void {
    retention.value = Number.isFinite(value) ? Math.max(100, Math.min(10_000, Math.round(value))) : 2000;
    if (logs.value.length > retention.value) logs.value.length = retention.value;
  }

  function addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): void {
    logs.value.unshift({ id: createId('log'), timestamp: new Date().toISOString(), ...entry });
    if (logs.value.length > retention.value) logs.value.length = retention.value;
  }

  function pushToast(toast: Omit<ToastMessage, 'id'>): void {
    const item: ToastMessage = { id: createId('toast'), timeoutMs: 4200, ...toast };
    toasts.value.push(item);
    if (item.timeoutMs && item.timeoutMs > 0) {
      window.setTimeout(() => dismissToast(item.id), item.timeoutMs);
    }
  }

  function dismissToast(toastId: string): void {
    toasts.value = toasts.value.filter((item) => item.id !== toastId);
  }

  async function exportLogs(): Promise<void> {
    try {
      const path = await chooseLogPath();
      if (!path) return;
      await writeLogFile(path, JSON.stringify(logs.value, null, 2));
      addLog({ level: 'success', message: `日志已导出到 ${path}` });
      pushToast({ level: 'success', title: '日志已导出', message: path });
    } catch (error) {
      addLog({ level: 'error', message: `导出日志失败：${String(error)}` });
      pushToast({ level: 'error', title: '日志导出失败', message: String(error) });
    }
  }

  return {
    logs,
    toasts,
    logDrawerOpen,
    setRetention,
    addLog,
    pushToast,
    dismissToast,
    exportLogs,
  };
});
