<script setup lang="ts">
import { computed } from 'vue';
import { useChannelStore } from '../../stores/channels';
import { useTaskCenterStore } from '../../stores/taskCenter';
import { EXTRACTION_HISTORY_LIMIT_OPTIONS, TASK_HISTORY_RETENTION_OPTIONS } from '../../config/appearance';

const store = useChannelStore();
const tasks = useTaskCenterStore();

const savedCount = computed(() => tasks.records.length);
const finishedCount = computed(() => tasks.finishedRecords.length);
const lastSuccess = computed(() => tasks.lastSuccessRecord);
const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function formatTime(value?: string): string {
  return value ? timeFormatter.format(new Date(value)) : '—';
}
</script>

<template>
  <section class="settings-section settings-two-column">
    <div class="settings-panel">
      <h3>任务中心</h3>
      <label class="settings-field">
        <span>任务历史保留数量</span>
        <select v-model.number="store.appSettings.taskHistoryRetention" class="option-input">
          <option v-for="option in TASK_HISTORY_RETENTION_OPTIONS" :key="option" :value="option">{{ option }} 条</option>
        </select>
      </label>
      <p class="settings-note">当前已保存 <b>{{ savedCount }}</b> 条记录，其中已结束 <b>{{ finishedCount }}</b> 条。超出上限时会自动丢弃最早的记录。</p>

      <label class="settings-field">
        <span>解压历史显示条数</span>
        <select v-model.number="store.appSettings.extractionHistoryLimit" class="option-input">
          <option v-for="option in EXTRACTION_HISTORY_LIMIT_OPTIONS" :key="option" :value="option">最近 {{ option }} 次</option>
        </select>
      </label>
      <p class="settings-note">
        <template v-if="lastSuccess">
          最近一次成功解压：<b>{{ lastSuccess.fileName }}</b> · {{ formatTime(lastSuccess.finishedAt) }}
        </template>
        <template v-else>还没有成功解压记录，完成一次解压后会显示在这里。</template>
      </p>

      <label class="switch-row">
        <span><b>失败时自动打开任务中心</b><small>第一时间查看错误、耗时与输出清单</small></span>
        <input v-model="store.appSettings.autoOpenTaskCenterOnFailure" type="checkbox" />
      </label>
      <div class="maintenance-actions">
        <button class="btn btn-primary" type="button" @click="tasks.historyDrawerOpen = true">打开解压历史</button>
        <button class="btn" type="button" @click="tasks.drawerOpen = true">打开任务中心</button>
        <button class="btn" type="button" :disabled="tasks.activeCount > 0" @click="tasks.clearCompleted">清理已结束记录</button>
        <button class="btn btn-ghost" type="button" :disabled="tasks.records.length === 0" @click="tasks.clearAll">清空全部历史</button>
      </div>
    </div>

    <div class="settings-panel">
      <h3>解压结果删除</h3>
      <label class="switch-row">
        <span><b>删除前确认</b><small>删除按钮会先展示本次写入与替换文件数量</small></span>
        <input v-model="store.appSettings.confirmBeforeDeleteOutput" type="checkbox" />
      </label>
      <label class="switch-row danger-setting">
        <span><b>同时删除曾被替换的文件</b><small>关闭时只删除本次新增文件；建议保持关闭</small></span>
        <input v-model="store.appSettings.deleteReplacedOutputs" type="checkbox" />
      </label>
      <div class="reliability-note">
        <b>安全删除原理</b>
        <p>每次成功解压都会在应用数据目录写入独立清单。删除操作只读取该清单，不会直接清空整个目标目录；本次覆盖过旧内容的文件默认保留。</p>
      </div>
    </div>
  </section>

  <section class="settings-section">
    <div class="settings-section-head">
      <div>
        <h3>可靠性策略</h3>
        <p>适合大批量或重要项目目录的保护选项。</p>
      </div>
    </div>
    <div class="settings-three-column">
      <label class="switch-row"><span><b>覆盖前确认</b><small>批次启动前确认所有覆盖型通道</small></span><input v-model="store.appSettings.confirmBeforeOverwrite" type="checkbox" /></label>
      <label class="switch-row"><span><b>错误时展开通道</b><small>直接显示路径、密码和层级设置</small></span><input v-model="store.appSettings.autoExpandOnError" type="checkbox" /></label>
      <label class="switch-row"><span><b>保留空目录</b><small>新通道默认保留归档内空文件夹</small></span><input v-model="store.appSettings.defaultKeepEmptyDirectories" type="checkbox" /></label>
    </div>
  </section>
</template>
