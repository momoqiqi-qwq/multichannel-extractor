<script setup lang="ts">
import { useChannelStore } from '../../stores/channels';
import { useTaskCenterStore } from '../../stores/taskCenter';
import { APP_RELEASE_NAME, APP_VERSION, CONFIG_SCHEMA_VERSION } from '../../config/version';

const store = useChannelStore();
const tasks = useTaskCenterStore();

type Profile = 'safe' | 'balanced' | 'fast' | 'minimal';

function applyProfile(profile: Profile): void {
  if (profile === 'safe') {
    store.maxConcurrency = 2;
    Object.assign(store.appSettings, {
      preflightEnabled: true,
      preflightCheckPassword: true,
      preflightCheckDiskSpace: true,
      preflightCheckConflicts: true,
      showOutputPreviewBeforeStart: true,
      confirmBeforeOverwrite: true,
      confirmBeforeDeleteOutput: true,
      deleteReplacedOutputs: false,
      autoResumeInterrupted: false,
      showRecoveryBanner: true,
      enablePauseResume: true,
      showEta: true,
    });
  } else if (profile === 'fast') {
    store.maxConcurrency = 6;
    Object.assign(store.appSettings, {
      preflightEnabled: true,
      preflightCheckPassword: true,
      preflightCheckDiskSpace: false,
      preflightCheckConflicts: false,
      showOutputPreviewBeforeStart: false,
      confirmBeforeOverwrite: false,
      autoResumeInterrupted: true,
      autoCollapseSuccessful: true,
      successToasts: false,
      enablePauseResume: true,
      showEta: true,
    });
  } else if (profile === 'minimal') {
    store.maxConcurrency = 3;
    Object.assign(store.appSettings, {
      showOutputPreviewBeforeStart: false,
      showRecoveryBanner: false,
      hideCompletedFiles: true,
      autoCollapseSuccessful: true,
      compactTopbar: true,
      successToasts: false,
      showPathHints: false,
      showLayoutExamples: false,
      hideDescriptions: true,
      showDetailedExplanations: false,
    });
  } else {
    store.maxConcurrency = 3;
    Object.assign(store.appSettings, {
      preflightEnabled: true,
      preflightCheckPassword: true,
      preflightCheckDiskSpace: true,
      preflightCheckConflicts: true,
      showOutputPreviewBeforeStart: true,
      confirmBeforeOverwrite: true,
      autoResumeInterrupted: false,
      showRecoveryBanner: true,
      autoCollapseSuccessful: false,
      compactTopbar: false,
      successToasts: true,
      showPathHints: true,
      showLayoutExamples: true,
      hideDescriptions: false,
      showDetailedExplanations: true,
      enablePauseResume: true,
      showEta: true,
      enableFilePriority: true,
    });
  }
  store.pushToast({ level: 'success', title: '设置方案已应用', message: profile === 'safe' ? '稳妥模式' : profile === 'fast' ? '高效模式' : profile === 'minimal' ? '极简模式' : '均衡模式' });
}
</script>

<template>
  <section class="settings-section general-overview">
    <div class="settings-section-head">
      <div>
        <h3>常用设置</h3>
        <p>先选一个使用方案，再到左侧分类中微调每个选项。</p>
      </div>
      <span class="settings-badge">可随时调整</span>
    </div>
    <div class="settings-profile-grid">
      <button type="button" class="settings-profile-card" @click="applyProfile('safe')">
        <span class="profile-icon">盾</span><b>稳妥模式</b><small>低并发、完整自检、覆盖与删除确认</small>
      </button>
      <button type="button" class="settings-profile-card recommended" @click="applyProfile('balanced')">
        <span class="profile-icon">衡</span><b>均衡模式</b><small>完整功能与三路并发，适合日常使用</small>
      </button>
      <button type="button" class="settings-profile-card" @click="applyProfile('fast')">
        <span class="profile-icon">速</span><b>高效模式</b><small>提高并发，减少启动前提示和成功通知</small>
      </button>
      <button type="button" class="settings-profile-card" @click="applyProfile('minimal')">
        <span class="profile-icon">简</span><b>极简模式</b><small>紧凑顶栏、隐藏完成项、减少辅助说明</small>
      </button>
    </div>
  </section>

  <section class="settings-section settings-two-column">
    <div class="settings-panel">
      <h3>当前工作区</h3>
      <div class="settings-info-grid compact-info-grid">
        <span><b>通道</b>{{ store.channels.length }}</span>
        <span><b>文件</b>{{ store.totalFiles }}</span>
        <span><b>运行中</b>{{ store.processingFiles }}</span>
        <span><b>可恢复</b>{{ tasks.recoverableRecords.length }}</span>
        <span class="version-info-item"><b>发布版本</b>{{ APP_RELEASE_NAME }}</span>
        <span class="version-info-item"><b>技术版本</b>v{{ APP_VERSION }}</span>
        <span class="version-info-item"><b>配置架构</b>v{{ CONFIG_SCHEMA_VERSION }}</span>
      </div>
      <div class="maintenance-actions general-action-row">
        <button class="btn btn-primary" type="button" :disabled="!store.hasStartableWork || store.processingFiles > 0 || store.inboxScanningIds.length > 0" @click="store.startAll">{{ !store.hasRunnableFiles && store.hasScannableChannels ? '扫描最新版并开始' : '开始全部任务' }}</button>
        <button class="btn" type="button" @click="tasks.drawerOpen = true">打开任务中心</button>
        <button class="btn" type="button" :disabled="!tasks.recoverableRecords.length || store.processingFiles > 0" @click="store.resumeInterruptedTasks(false)">恢复中断任务</button>
      </div>
    </div>

    <div class="settings-panel">
      <h3>常用开关</h3>
      <label class="switch-row"><span><b>关闭基础描述</b><small>隐藏设置项和通道设置中的简短辅助说明，只保留名称与操作控件</small></span><input v-model="store.appSettings.hideDescriptions" type="checkbox" /></label>
      <label class="switch-row"><span><b>显示详细解释</b><small>在支持的设置页显示更完整的用途、影响范围与注意事项</small></span><input v-model="store.appSettings.showDetailedExplanations" type="checkbox" /></label>
      <div class="settings-detail-callout detailed-explanation"><b>详细解释已开启</b><span>基础描述用于快速浏览；详细解释会补充“这个选项会影响什么、什么时候生效、需要注意什么”。关闭基础描述不会强制关闭此开关，但详细解释仍会单独遵循本开关。</span></div>
      <label class="switch-row"><span><b>开始前输出预览</b><small>确认路径与冲突后再写入</small></span><input v-model="store.appSettings.showOutputPreviewBeforeStart" type="checkbox" /></label>
      <label class="switch-row"><span><b>允许暂停与继续</b><small>长任务可在安全检查点暂停</small></span><input v-model="store.appSettings.enablePauseResume" type="checkbox" /></label>
      <label class="switch-row"><span><b>显示剩余时间</b><small>任务中心展示动态 ETA</small></span><input v-model="store.appSettings.showEta" type="checkbox" /></label>
      <label class="switch-row"><span><b>文件优先级</b><small>允许高、普通、低三级调度</small></span><input v-model="store.appSettings.enableFilePriority" type="checkbox" /></label>
    </div>
  </section>
</template>
