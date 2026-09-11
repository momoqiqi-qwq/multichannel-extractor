import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { deleteExtraction, openOutput } from '../services/tauri';
import { createId } from '../domain/state';
import type {
  BatchFinishedEvent,
  DeleteExtractionResult,
  ExtractionJobPayload,
  JobFinishedEvent,
  ProgressEvent,
  TaskRecord,
  TaskRecordStatus,
} from '../types';

const TASK_HISTORY_KEY = 'jieyatai-task-history-v2';
const LEGACY_TASK_HISTORY_KEYS = ['jieyatai-task-history-v1'];

function now(): string {
  return new Date().toISOString();
}

function loadHistory(): TaskRecord[] {
  try {
    const raw = [TASK_HISTORY_KEY, ...LEGACY_TASK_HISTORY_KEYS]
      .map((key) => localStorage.getItem(key))
      .find(Boolean);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TaskRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((record) =>
      ['queued', 'processing', 'paused'].includes(record.status)
        ? {
            ...record,
            status: 'interrupted' as TaskRecordStatus,
            message: record.jobSnapshot
              ? '应用上次退出时任务未完成，可从任务中心恢复'
              : '应用上次退出时任务仍在运行；旧版记录缺少恢复快照，可重新导入文件',
            finishedAt: record.finishedAt || now(),
            etaSeconds: undefined,
            pausedAt: undefined,
          }
        : record,
    );
  } catch {
    return [];
  }
}

export const useTaskCenterStore = defineStore('taskCenter', () => {
  const records = ref<TaskRecord[]>(loadHistory());
  const drawerOpen = ref(false);
  const historyDrawerOpen = ref(false);
  const filter = ref<'all' | 'active' | 'success' | 'error'>('all');
  const search = ref('');

  /** 已结束的解压记录（按时间倒序，records 本身即倒序）。 */
  const finishedRecords = computed(() =>
    records.value.filter((record) => !['queued', 'processing', 'paused'].includes(record.status)),
  );
  /** 最近一次成功解压，用于设置页摘要展示。 */
  const lastSuccessRecord = computed(() => records.value.find((record) => record.status === 'success'));

  const activeCount = computed(
    () => records.value.filter((record) => ['queued', 'processing', 'paused'].includes(record.status)).length,
  );
  const pausedCount = computed(() => records.value.filter((record) => record.status === 'paused').length);
  const failedCount = computed(
    () => records.value.filter((record) => ['error', 'interrupted'].includes(record.status)).length,
  );
  const interruptedCount = computed(() => records.value.filter((record) => record.status === 'interrupted').length);
  const recoverableRecords = computed(() =>
    records.value.filter((record) => record.status === 'interrupted' && Boolean(record.jobSnapshot)),
  );
  const visibleRecords = computed(() => {
    const query = search.value.trim().toLocaleLowerCase();
    return records.value.filter((record) => {
      if (filter.value === 'active' && !['queued', 'processing', 'paused'].includes(record.status)) return false;
      if (filter.value === 'success' && record.status !== 'success') return false;
      if (filter.value === 'error' && !['error', 'interrupted'].includes(record.status)) return false;
      if (!query) return true;
      return [record.fileName, record.channelName, record.archivePath, record.outputPath || '']
        .some((value) => value.toLocaleLowerCase().includes(query));
    });
  });

  watch(
    records,
    (value) => localStorage.setItem(TASK_HISTORY_KEY, JSON.stringify(value)),
    { deep: true },
  );

  function trim(limit: number): void {
    const normalized = Math.max(50, Math.min(5000, Math.round(limit || 500)));
    if (records.value.length > normalized) records.value.length = normalized;
  }

  /** 取最近 N 次已结束的解压记录（用于「解压历史」抽屉）。 */
  function recentExtractions(limit: number): TaskRecord[] {
    const normalized = Math.max(3, Math.min(200, Math.round(limit || 20)));
    return finishedRecords.value.slice(0, normalized);
  }

  function enqueue(
    jobs: ExtractionJobPayload[],
    channelNames: Map<string, string>,
    fileNames: Map<string, string>,
    retention: number,
  ): void {
    const timestamp = now();
    const additions = jobs.map<TaskRecord>((job) => {
      const { password, ...jobSnapshot } = job;
      return {
        id: createId('task'),
        jobId: job.jobId,
        channelId: job.channelId,
        channelName: channelNames.get(job.channelId) || '未知通道',
        archivePath: job.archivePath,
        fileName: fileNames.get(job.jobId) || job.archivePath.split(/[\\/]/).pop() || job.archivePath,
        status: 'queued',
        progress: 0,
        phase: 'queued',
        message: '已加入任务队列',
        createdAt: timestamp,
        writtenFiles: 0,
        replacedFiles: 0,
        jobSnapshot,
        requiresPassword: Boolean(password),
        pausedDurationMs: 0,
      };
    });
    records.value.unshift(...additions);
    trim(retention);
  }

  function latestForJob(jobId: string): TaskRecord | undefined {
    return records.value.find((record) => record.jobId === jobId && ['queued', 'processing', 'paused'].includes(record.status));
  }

  function attachBatch(batchId: string, jobIds: string[]): void {
    for (const jobId of jobIds) {
      const record = latestForJob(jobId);
      if (record) record.batchId = batchId;
    }
  }

  function failToStart(jobIds: string[], message: string): void {
    for (const jobId of jobIds) {
      const record = latestForJob(jobId);
      if (!record) continue;
      record.status = 'error';
      record.message = message;
      record.finishedAt = now();
      record.etaSeconds = undefined;
    }
  }

  function onProgress(event: ProgressEvent): void {
    const record = latestForJob(event.jobId);
    if (!record) return;
    record.status = event.phase === 'queued' ? 'queued' : event.phase === 'paused' ? 'paused' : 'processing';
    record.phase = event.phase;
    record.progress = Math.max(record.progress, Math.min(100, Math.round(event.progress)));
    record.message = event.message;
    if (!record.startedAt && !['queued', 'paused'].includes(event.phase)) record.startedAt = now();
    if (record.startedAt && record.progress > 0 && record.progress < 100 && record.status === 'processing') {
      const elapsedMs = Date.now() - new Date(record.startedAt).getTime() - (record.pausedDurationMs || 0);
      const elapsedSeconds = Math.max(1, elapsedMs / 1000);
      record.etaSeconds = Math.max(1, Math.round((elapsedSeconds / record.progress) * (100 - record.progress)));
    }
  }

  function markPaused(jobId: string): void {
    const record = latestForJob(jobId);
    if (!record) return;
    record.status = 'paused';
    record.phase = 'paused';
    record.message = '任务已暂停；继续后会从当前检查点运行';
    record.pausedAt = now();
    record.etaSeconds = undefined;
  }

  function markResumed(jobId: string): void {
    const record = latestForJob(jobId);
    if (!record) return;
    if (record.pausedAt) {
      record.pausedDurationMs = (record.pausedDurationMs || 0) + Math.max(0, Date.now() - new Date(record.pausedAt).getTime());
    }
    record.pausedAt = undefined;
    record.status = record.progress > 0 ? 'processing' : 'queued';
    record.phase = record.progress > 0 ? 'extracting' : 'queued';
    record.message = '任务已继续';
  }

  function markRecovered(recordId: string, submitted = true): void {
    const record = records.value.find((item) => item.id === recordId);
    if (!record) return;
    record.status = 'recovered';
    record.message = submitted ? '已根据恢复快照重新提交' : '已恢复到工作区，等待重新输入密码';
    record.finishedAt = now();
  }

  function onJobFinished(event: JobFinishedEvent): void {
    const record = latestForJob(event.jobId);
    if (!record) return;
    record.status = event.success ? 'success' : event.error === '任务已取消' ? 'cancelled' : 'error';
    record.progress = event.success ? 100 : record.progress;
    record.message = event.success ? '解压完成' : event.error || '解压失败';
    record.finishedAt = now();
    record.durationMs = event.durationMs;
    record.outputPath = event.outputPath;
    record.manifestPath = event.manifestPath;
    record.writtenFiles = event.writtenFiles;
    record.replacedFiles = event.replacedFiles;
    record.etaSeconds = undefined;
    record.pausedAt = undefined;
  }

  function onBatchFinished(_event: BatchFinishedEvent): void {
    // Per-file events contain the authoritative result.
  }

  async function openRecordOutput(record: TaskRecord): Promise<void> {
    if (!record.outputPath) throw new Error('该任务没有可打开的输出位置');
    await openOutput(record.outputPath);
  }

  function markOutputDeleted(manifestPath: string, result: DeleteExtractionResult): void {
    for (const record of records.value.filter((item) => item.manifestPath === manifestPath)) {
      record.status = 'deleted';
      record.outputDeleted = true;
      record.message = result.skippedReplacedFiles
        ? `已删除 ${result.deletedFiles} 个新增文件；保留 ${result.skippedReplacedFiles} 个曾被替换的文件`
        : `已删除 ${result.deletedFiles} 个文件`;
      record.manifestPath = undefined;
    }
  }

  async function deleteRecordOutput(record: TaskRecord, deleteReplaced: boolean): Promise<DeleteExtractionResult> {
    if (!record.manifestPath) throw new Error('该任务没有安全删除清单，无法一键删除');
    const manifestPath = record.manifestPath;
    const result = await deleteExtraction(manifestPath, deleteReplaced);
    markOutputDeleted(manifestPath, result);
    return result;
  }

  function removeRecord(recordId: string): void {
    records.value = records.value.filter((record) => record.id !== recordId);
  }

  function clearCompleted(): void {
    records.value = records.value.filter((record) => ['queued', 'processing', 'paused'].includes(record.status));
  }

  function clearAll(): void {
    records.value = [];
  }

  return {
    records,
    drawerOpen,
    historyDrawerOpen,
    filter,
    search,
    activeCount,
    pausedCount,
    failedCount,
    interruptedCount,
    recoverableRecords,
    visibleRecords,
    finishedRecords,
    lastSuccessRecord,
    trim,
    recentExtractions,
    enqueue,
    attachBatch,
    failToStart,
    onProgress,
    markPaused,
    markResumed,
    markRecovered,
    onJobFinished,
    onBatchFinished,
    openRecordOutput,
    markOutputDeleted,
    deleteRecordOutput,
    removeRecord,
    clearCompleted,
    clearAll,
  };
});
