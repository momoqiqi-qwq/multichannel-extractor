<script setup lang="ts">
import { THEME_DEFINITIONS } from '../config/appearance';
import { useChannelStore } from '../stores/channels';
import { useTaskCenterStore } from '../stores/taskCenter';

const store = useChannelStore();
const taskCenter = useTaskCenterStore();

function openFullSettings(event: MouseEvent): void {
  (event.currentTarget as HTMLElement | null)?.closest('details')?.removeAttribute('open');
  store.logDrawerOpen = false;
  taskCenter.drawerOpen = false;
  store.settingsOpen = true;
}
</script>

<template>
  <details class="quick-settings">
    <summary class="btn btn-ghost" title="常用设置与批量操作">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></svg>
      快捷
    </summary>
    <div class="quick-settings-popover">
      <div class="quick-settings-head">
        <div><b>快捷设置</b><span>常用选项即时生效</span></div>
        <button class="text-action" type="button" @click="openFullSettings">完整设置</button>
      </div>
      <label class="quick-field">
        <span>主题</span>
        <select v-model="store.appSettings.theme" class="option-input">
          <option v-for="theme in THEME_DEFINITIONS" :key="theme.id" :value="theme.id">{{ theme.name }}</option>
        </select>
      </label>
      <div class="quick-field">
        <span>界面密度</span>
        <div class="quick-segments">
          <button type="button" :class="{ active: store.appSettings.density === 'compact' }" @click="store.appSettings.density = 'compact'">紧凑</button>
          <button type="button" :class="{ active: store.appSettings.density === 'comfortable' }" @click="store.appSettings.density = 'comfortable'">舒适</button>
          <button type="button" :class="{ active: store.appSettings.density === 'spacious' }" @click="store.appSettings.density = 'spacious'">宽松</button>
        </div>
      </div>
      <label class="switch-row compact-switch"><span><b>按分类分组</b><small>主界面按通道类型分段</small></span><input v-model="store.appSettings.groupByCategory" type="checkbox" /></label>
      <label class="switch-row compact-switch"><span><b>隐藏完成文件</b><small>只影响队列显示，不删除记录</small></span><input v-model="store.appSettings.hideCompletedFiles" type="checkbox" /></label>
      <label class="switch-row compact-switch"><span><b>紧凑顶栏</b><small>为小屏幕释放更多空间</small></span><input v-model="store.appSettings.compactTopbar" type="checkbox" /></label>
      <label class="switch-row compact-switch"><span><b>显示背景图片</b><small>不删除图片，只切换显示状态</small></span><input v-model="store.appSettings.backgroundImageEnabled" type="checkbox" :disabled="!store.appSettings.backgroundImagePath" /></label>
      <label class="switch-row compact-switch"><span><b>通道背景穿透</b><small>让通道卡片显示更多背景</small></span><input v-model="store.appSettings.channelTransparencyEnabled" type="checkbox" /></label>
      <label class="quick-field">
        <span>背景可见度</span>
        <span class="range-field appearance-range"><input v-model.number="store.appSettings.backgroundOpacity" type="range" min="0.08" max="1" step="0.02" :disabled="!store.appSettings.backgroundImagePath" /><output>{{ Math.round(store.appSettings.backgroundOpacity * 100) }}%</output></span>
      </label>
      <div class="quick-field">
        <span>新通道输出容器</span>
        <div class="quick-segments">
          <button type="button" :class="{ active: !store.appSettings.defaultCreateArchiveSubfolder }" @click="store.appSettings.defaultCreateArchiveSubfolder = false">直接写入</button>
          <button type="button" :class="{ active: store.appSettings.defaultCreateArchiveSubfolder }" @click="store.appSettings.defaultCreateArchiveSubfolder = true">同名文件夹</button>
        </div>
      </div>
      <label class="quick-field">
        <span>重名文件</span>
        <select v-model="store.appSettings.defaultCollisionPolicy" class="option-input">
          <option value="overwrite">直接替换</option>
          <option value="rename">自动重命名</option>
          <option value="skip">跳过</option>
        </select>
      </label>
      <label class="switch-row compact-switch"><span><b>显示层级示例</b><small>通道内实时显示预计输出路径</small></span><input v-model="store.appSettings.showLayoutExamples" type="checkbox" /></label>
      <div class="quick-actions">
        <button class="btn btn-sm" type="button" :disabled="store.inboxScanningIds.length > 0 || !store.channels.some((channel) => channel.inboxEnabled && channel.inboxDirectory && channel.inboxKeywords)" @click="store.scanAllKeywordChannels()">扫描关键词收件</button>
        <button class="btn btn-sm" type="button" :disabled="store.failedFiles === 0 || store.processingFiles > 0" @click="store.startFailed">重试失败</button>
        <button class="btn btn-sm" type="button" :disabled="store.completedFiles === 0" @click="store.clearAllFinished">清理完成</button>
      </div>
    </div>
  </details>
</template>
