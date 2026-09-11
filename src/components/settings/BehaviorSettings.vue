<script setup lang="ts">
import { useChannelStore } from '../../stores/channels';
const store = useChannelStore();
</script>

<template>
<section class="settings-section settings-two-column">
            <div class="settings-panel">
              <h3>队列与并发</h3>
              <label class="settings-field">
                <span>最大并发数</span>
                <div class="range-field">
                  <input v-model.number="store.maxConcurrency" type="range" min="1" max="8" />
                  <input v-model.number="store.maxConcurrency" class="number-input" type="number" min="1" max="8" />
                </div>
              </label>
              <label class="settings-field">
                <span>队列调度方式</span>
                <select v-model="store.appSettings.queueStrategy" class="option-input">
                  <option value="roundRobin">通道轮询（更均衡）</option>
                  <option value="channelOrder">按通道顺序</option>
                </select>
              </label>
              <label class="settings-field">
                <span>重复文件导入</span>
                <select v-model="store.appSettings.duplicateImportPolicy" class="option-input">
                  <option value="ignore">忽略重复项</option>
                  <option value="replace">更新已有队列项</option>
                  <option value="allow">允许重复任务</option>
                </select>
              </label>
              <label class="switch-row">
                <span><b>新通道默认自动开始</b><small>默认开启；导入、拖入或关键词收件加入新文件后立即处理，每个通道仍可单独关闭</small></span>
                <input v-model="store.appSettings.autoStartAfterImport" type="checkbox" />
              </label>
              <label class="switch-row">
                <span><b>空队列开始时扫描最新版</b><small>没有拖入或选择压缩包时，点击开始会先扫描已配置的关键词收件目录，加入最新版并自动开始</small></span>
                <input v-model="store.appSettings.scanLatestOnEmptyStart" type="checkbox" />
              </label>
              <label class="switch-row">
                <span><b>批次结束后自动清理</b><small>短暂显示结果后移除成功与取消项</small></span>
                <input v-model="store.appSettings.autoClearCompleted" type="checkbox" />
              </label>
              <label class="switch-row">
                <span><b>错误时自动展开通道</b><small>便于立即查看错误与修改设置</small></span>
                <input v-model="store.appSettings.autoExpandOnError" type="checkbox" />
              </label>
              <label class="switch-row">
                <span><b>成功后自动收起通道</b><small>队列全部成功时回收设置区域</small></span>
                <input v-model="store.appSettings.autoCollapseSuccessful" type="checkbox" />
              </label>
            </div>

            <div class="settings-panel">
              <h3>操作习惯</h3>
              <label class="switch-row">
                <span><b>删除前确认</b><small>含文件或正在运行时弹出确认</small></span>
                <input v-model="store.appSettings.confirmBeforeDelete" type="checkbox" />
              </label>
              <label class="switch-row">
                <span><b>新通道自动展开</b><small>创建后直接显示详细设置</small></span>
                <input v-model="store.appSettings.autoExpandNewChannel" type="checkbox" />
              </label>
              <label class="switch-row">
                <span><b>默认完成后打开</b><small>新通道完成后自动打开目标目录</small></span>
                <input v-model="store.appSettings.defaultOpenAfter" type="checkbox" />
              </label>
              <label class="switch-row">
                <span><b>直接替换前确认</b><small>关闭后重名文件会按通道设置直接替换，不再弹窗</small></span>
                <input v-model="store.appSettings.confirmBeforeOverwrite" type="checkbox" />
              </label>
              <label class="switch-row">
                <span><b>显示成功通知</b><small>批次全部成功时显示 Toast</small></span>
                <input v-model="store.appSettings.successToasts" type="checkbox" />
              </label>
              <label class="switch-row">
                <span><b>显示错误通知</b><small>失败任务和失败批次显示 Toast</small></span>
                <input v-model="store.appSettings.errorToasts" type="checkbox" />
              </label>
              <label class="settings-field">
                <span>日志保留条数</span>
                <select v-model.number="store.appSettings.logRetention" class="option-input">
                  <option :value="500">500</option>
                  <option :value="2000">2,000</option>
                  <option :value="5000">5,000</option>
                  <option :value="10000">10,000</option>
                </select>
              </label>
            </div>
          </section>

          <section class="settings-section">
            <div class="settings-section-head">
              <div>
                <h3>快捷键</h3>
                <p>在输入框中不会触发全局快捷键。</p>
              </div>
            </div>
            <div class="shortcut-grid">
              <span><kbd>Ctrl / Cmd</kbd><kbd>N</kbd><b>新建通道</b></span>
              <span><kbd>Ctrl / Cmd</kbd><kbd>,</kbd><b>打开设置</b></span>
              <span><kbd>Ctrl / Cmd</kbd><kbd>Enter</kbd><b>全部开始</b></span>
              <span><kbd>Esc</kbd><b>关闭抽屉</b></span>
            </div>
          </section>
</template>
