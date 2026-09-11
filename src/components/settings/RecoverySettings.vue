<script setup lang="ts">
import { useChannelStore } from '../../stores/channels';
import { useTaskCenterStore } from '../../stores/taskCenter';

const store = useChannelStore();
const tasks = useTaskCenterStore();
</script>

<template>
  <section class="settings-section">
    <div class="settings-section-head">
      <div>
        <h3>开始前自检</h3>
        <p>在真正写入磁盘前检查源文件、密码提示、输出路径、空间与冲突。</p>
      </div>
      <span class="settings-badge">0.7.0</span>
    </div>
    <div class="settings-three-column">
      <label class="switch-row"><span><b>启用开始前自检</b><small>关闭后只执行最基本的目录校验</small></span><input v-model="store.appSettings.preflightEnabled" type="checkbox" /></label>
      <label class="switch-row"><span><b>显示树形输出预览</b><small>开始前确认每个压缩包的最终输出根目录</small></span><input v-model="store.appSettings.showOutputPreviewBeforeStart" type="checkbox" /></label>
      <label class="switch-row"><span><b>检查密码输入</b><small>ZIP、7Z、RAR 未输入密码时给出提示</small></span><input v-model="store.appSettings.preflightCheckPassword" type="checkbox" /></label>
      <label class="switch-row"><span><b>检查磁盘空间</b><small>按压缩包体积估算临时空间与输出空间</small></span><input v-model="store.appSettings.preflightCheckDiskSpace" type="checkbox" /></label>
      <label class="switch-row"><span><b>检查文件冲突</b><small>目标目录已有内容时展示重名处理策略</small></span><input v-model="store.appSettings.preflightCheckConflicts" type="checkbox" /></label>
      <label class="settings-field self-check-number">
        <span>额外保留空间（MB）</span>
        <input v-model.number="store.appSettings.preflightMinimumFreeMb" class="option-input" type="number" min="0" max="102400" step="256" />
      </label>
      <label class="settings-field self-check-number">
        <span>空间估算倍率</span>
        <input v-model.number="store.appSettings.preflightSpaceMultiplier" class="option-input" type="number" min="1" max="10" step="1" />
        <small>默认按压缩包体积的 3 倍估算；图片、视频可调低，源码或高度压缩归档可调高。</small>
      </label>
    </div>
    <div class="reliability-note">
      <b>自检不会读取或保存密码</b>
      <p>密码检测只判断是否已输入。真正的密码正确性仍由解压器在运行时验证；不支持的文件会在提交前明确列出并跳过。</p>
    </div>
  </section>

  <section class="settings-section settings-two-column">
    <div class="settings-panel">
      <h3>断点恢复</h3>
      <label class="switch-row"><span><b>启动后自动恢复</b><small>自动重新提交不需要密码的中断任务</small></span><input v-model="store.appSettings.autoResumeInterrupted" type="checkbox" /></label>
      <label class="switch-row"><span><b>显示恢复横幅</b><small>工作区顶部提醒上次未完成的任务</small></span><input v-model="store.appSettings.showRecoveryBanner" type="checkbox" /></label>
      <label class="switch-row"><span><b>恢复前确认</b><small>手动恢复时先显示确认对话框</small></span><input v-model="store.appSettings.confirmBeforeResumeInterrupted" type="checkbox" /></label>
      <div class="maintenance-actions">
        <button class="btn btn-primary" type="button" :disabled="!tasks.recoverableRecords.length || store.processingFiles > 0" @click="store.resumeInterruptedTasks(false)">恢复 {{ tasks.recoverableRecords.length }} 个任务</button>
        <button class="btn" type="button" @click="tasks.drawerOpen = true">打开任务中心</button>
      </div>
      <div class="setting-note compact-note">
        <b>隐私保护</b>
        <span>恢复快照保存源路径和输出规则，但不保存密码。原任务使用过密码时，只恢复到工作区，等待你重新输入。</span>
      </div>
    </div>

    <div class="settings-panel">
      <h3>运行控制与估算</h3>
      <label class="switch-row"><span><b>允许暂停与继续</b><small>内置解压器在安全检查点暂停；外部 RAR/7Z 进程只能在调用前后响应</small></span><input v-model="store.appSettings.enablePauseResume" type="checkbox" /></label>
      <label class="switch-row"><span><b>显示剩余时间估算</b><small>根据当前任务进度和已运行时间动态估算</small></span><input v-model="store.appSettings.showEta" type="checkbox" /></label>
      <label class="switch-row"><span><b>允许文件优先级</b><small>高优先级文件会在全局队列中先于普通和低优先级</small></span><input v-model="store.appSettings.enableFilePriority" type="checkbox" /></label>
      <div class="settings-info-grid compact-info-grid">
        <span><b>中断记录</b>{{ tasks.interruptedCount }}</span>
        <span><b>可恢复</b>{{ tasks.recoverableRecords.length }}</span>
        <span><b>暂停中</b>{{ tasks.pausedCount }}</span>
        <span><b>活动任务</b>{{ tasks.activeCount }}</span>
      </div>
    </div>
  </section>
</template>
