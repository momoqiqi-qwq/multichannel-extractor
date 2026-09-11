<script setup lang="ts">
import { useChannelStore } from '../../stores/channels';
const store = useChannelStore();
function resetWorkspace(): void {
  if (window.confirm('确定重置整个工作区吗？所有通道配置和当前文件队列都会被清空。')) store.resetWorkspace();
}
async function importConfiguration(): Promise<void> {
  if (window.confirm('导入配置会替换当前通道、预设与全局设置。文件队列不会被导入，确定继续吗？')) await store.importConfiguration();
}

function renamePreset(name: string): void {
  const nextName = window.prompt('输入新的预设名称', name)?.trim();
  if (nextName) store.renamePreset(name, nextName);
}
function duplicatePreset(name: string): void {
  store.duplicatePreset(name);
}
</script>

<template>
<section class="settings-section">
            <div class="settings-section-head">
              <div>
                <h3>配置维护</h3>
                <p>恢复显示偏好、清理完成项或重置整个工作区。</p>
              </div>
            </div>
            <div class="maintenance-actions">
              <button class="btn btn-primary" type="button" @click="store.exportConfiguration">导出全部配置</button>
              <button class="btn" type="button" :disabled="store.processingFiles > 0" @click="importConfiguration">导入配置</button>
              <button class="btn" type="button" @click="store.exportTemplates">导出通道模板</button>
              <button class="btn" type="button" @click="store.importTemplates">导入通道模板</button>
              <button class="btn" type="button" @click="store.resetAppSettings">恢复默认设置</button>
              <button class="btn btn-ghost" type="button" :disabled="store.completedFiles === 0" @click="store.clearAllFinished">清理全部完成项</button>
              <button class="btn btn-danger" type="button" @click="resetWorkspace">重置工作区</button>
            </div>
          </section>

          <section class="settings-section">
            <div class="settings-section-head">
              <div>
                <h3>通道预设管理</h3>
                <p>预设可随完整配置备份，也可单独导入导出给其他设备使用。</p>
              </div>
            </div>
            <div v-if="store.presets.length" class="preset-management-list">
              <div v-for="(preset, index) in store.presets" :key="preset.name" class="preset-management-row">
                <span><b>{{ preset.name }}</b><small>{{ preset.useArchiveDirectory ? '跟随压缩包' : preset.destination || '未设置目录' }}</small></span>
                <div class="preset-management-actions">
                  <button class="btn btn-ghost btn-sm" type="button" :disabled="index === 0" title="上移预设" @click="store.movePreset(preset.name, -1)">↑</button>
                  <button class="btn btn-ghost btn-sm" type="button" :disabled="index === store.presets.length - 1" title="下移预设" @click="store.movePreset(preset.name, 1)">↓</button>
                  <button class="btn btn-ghost btn-sm" type="button" @click="renamePreset(preset.name)">重命名</button>
                  <button class="btn btn-ghost btn-sm" type="button" @click="duplicatePreset(preset.name)">复制</button>
                  <button class="btn btn-ghost btn-sm" type="button" @click="store.deletePreset(preset.name)">删除</button>
                </div>
              </div>
            </div>
            <div v-else class="settings-empty">还没有保存的通道预设。</div>
          </section>

          <section class="settings-section">
            <div class="settings-section-head">
              <div>
                <h3>数据说明</h3>
                <p>通道配置、主题和预设保存在本机 WebView 的 localStorage 中；密码不会持久化。</p>
              </div>
            </div>
            <div class="settings-info-grid">
              <span><b>当前通道</b>{{ store.channels.length }}</span>
              <span><b>通道预设</b>{{ store.presets.length }}</span>
              <span><b>最近目录</b>{{ store.recentDestinations.length }}</span>
              <span><b>日志条数</b>{{ store.logs.length }}</span>
            </div>
          </section>
</template>
