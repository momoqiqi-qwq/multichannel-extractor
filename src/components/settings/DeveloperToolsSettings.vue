<script setup lang="ts">
import { computed, ref } from 'vue';
import { useChannelStore } from '../../stores/channels';
import { openOutput } from '../../services/tauri';
import type { ClaudeCliStatus } from '../../types';

const store = useChannelStore();
const ready = computed(() => Boolean(store.appSettings.claudeToolsDirectory.trim()));
const cliStatus = ref<ClaudeCliStatus | null>(null);
const checking = ref(false);
const actionBusy = ref(false);

async function openDirectory(): Promise<void> {
  try {
    await openOutput(store.appSettings.claudeToolsDirectory);
  } catch (error) {
    store.pushToast({ level: 'error', title: '无法打开目录', message: String(error) });
  }
}

async function checkCli(): Promise<void> {
  checking.value = true;
  try {
    cliStatus.value = await store.checkClaudeAvailability(true);
  } finally {
    checking.value = false;
  }
}

async function resolveDirectory(): Promise<string> {
  const current = store.appSettings.claudeToolsDirectory.trim();
  return current || store.browseClaudeToolsDirectory();
}

async function runAction(action: 'generate' | 'launch'): Promise<void> {
  if (actionBusy.value) return;
  actionBusy.value = true;
  try {
    const directory = await resolveDirectory();
    if (!directory) return;
    if (action === 'generate') await store.generateClaudeDatAt(directory);
    else await store.launchClaudeAt(directory);
  } finally {
    actionBusy.value = false;
  }
}
</script>

<template>
  <section class="settings-section">
    <div class="settings-section-head">
      <div>
        <h3>Claude 项目辅助</h3>
        <p>Windows 下会在指定目录创建或读取 <code>我的Claude项目.dat</code>，再创建新命令窗口并执行 <code>claude --dangerously-skip-permissions</code>。</p>
      </div>
      <button class="btn btn-sm" type="button" :disabled="checking" @click="checkCli">{{ checking ? '检测中…' : '检测 Claude CLI' }}</button>
    </div>
    <div v-if="cliStatus" class="claude-status-card" :class="{ available: cliStatus.available, unavailable: !cliStatus.available }">
      <div>
        <b>{{ cliStatus.available ? 'Claude CLI 可用' : 'Claude CLI 不可用' }}</b>
        <span>{{ cliStatus.message }}</span>
        <small v-if="cliStatus.source">来源：{{ cliStatus.source }}</small>
      </div>
      <code v-if="cliStatus.executable">{{ cliStatus.executable }}</code>
    </div>
    <div class="developer-tool-card">
      <label class="settings-field developer-path-field">
        <span>手动项目文件夹</span>
        <div class="path-row">
          <input v-model="store.appSettings.claudeToolsDirectory" class="path-input" placeholder="选择要生成项目 DAT 或启动 Claude 的文件夹" />
          <button class="path-browse" type="button" title="选择文件夹" @click="store.browseClaudeToolsDirectory">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
          </button>
        </div>
      </label>
      <div class="maintenance-actions" :aria-busy="actionBusy">
        <button class="btn btn-primary" type="button" :disabled="actionBusy" @click="runAction('generate')">{{ actionBusy ? '处理中…' : '生成项目 DAT' }}</button>
        <button class="btn" type="button" :disabled="actionBusy" @click="runAction('launch')">{{ actionBusy ? '处理中…' : '一键启动 Claude' }}</button>
        <button class="btn btn-ghost" type="button" :disabled="!ready || actionBusy" @click="openDirectory">打开目录</button>
      </div>
      <div class="command-preview">
        <span>DAT 启动流程</span>
        <code>我的Claude项目.dat → cmd.exe /D /K "claude --dangerously-skip-permissions"</code>
      </div>
      <div class="setting-note compact-note">
        <b>目录选择规则</b>
        <span>通道按钮直接使用该通道配置的解压目录，不再额外弹出目录选择器；“跟随压缩包”模式使用压缩包所在目录。手动工具仍可在这里单独指定目录。</span>
      </div>
    </div>
  </section>

  <section class="settings-section settings-two-column">
    <div class="settings-panel">
      <h3>项目 DAT 行为</h3>
      <label class="switch-row">
        <span><b>更新已有 DAT</b><small>开启后生成按钮会刷新 DAT 元数据；关闭时保留已有文件并直接使用</small></span>
        <input v-model="store.appSettings.overwriteClaudeDat" type="checkbox" />
      </label>
      <label class="switch-row">
        <span><b>启动前刷新 DAT</b><small>开启时按“更新已有 DAT”设置刷新；关闭时仍会在 DAT 缺失时自动生成</small></span>
        <input v-model="store.appSettings.claudeAutoInstallDat" type="checkbox" />
      </label>
      <label class="switch-row">
        <span><b>生成后打开项目目录</b><small>便于立即查看或备份项目 DAT 文件</small></span>
        <input v-model="store.appSettings.openFolderAfterDatInstall" type="checkbox" />
      </label>
    </div>
    <div class="settings-panel">
      <h3>命令启动行为</h3>
      <label class="switch-row">
        <span><b>启动前检测 CLI</b><small>先查系统 PATH，再查 npm 全局目录与官方 @anthropic-ai/claude-code 包，失败时不创建空窗口</small></span>
        <input v-model="store.appSettings.claudeVerifyBeforeLaunch" type="checkbox" />
      </label>
      <label class="switch-row danger-setting">
        <span><b>启动前安全确认</b><small>弹窗明确显示将使用的工作目录与危险参数</small></span>
        <input v-model="store.appSettings.confirmBeforeClaudeBypass" type="checkbox" />
      </label>
      <div class="settings-note">启动器会校验目录与 DAT 文件，并可使用 npm 官方包安装出的 Claude CLI。未安装时可执行 <code>npm install -g @anthropic-ai/claude-code</code>。</div>
      <div class="settings-note">每个通道的“项目辅助工具”中可单独开启“解压完成后自动运行 Claude”。自动运行使用任务的实际输出目录，不显示启动确认；同一目录 8 秒内只创建一个窗口。</div>
    </div>
  </section>

  <section class="settings-section warning-section">
    <div class="settings-section-head">
      <div>
        <h3>权限提示</h3>
        <p><code>--dangerously-skip-permissions</code> 会跳过工具调用权限确认，只应在你完全信任的项目目录和代码仓库中使用。</p>
      </div>
    </div>
  </section>
</template>
