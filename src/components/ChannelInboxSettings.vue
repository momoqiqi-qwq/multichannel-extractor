<script setup lang="ts">
import { computed } from 'vue';
import { useChannelStore } from '../stores/channels';
import type { Channel } from '../types';

const props = defineProps<{ channel: Channel }>();
const store = useChannelStore();
const scanning = computed(() => store.inboxScanningIds.includes(props.channel.id));
const result = computed(() => store.latestInboxResult(props.channel.id));
const selectedAlreadyAdded = computed(() => Boolean(
  result.value?.selectedPath && props.channel.files.some((file) => file.path === result.value?.selectedPath),
));
const keywordCount = computed(() =>
  props.channel.inboxKeywords
    .split(/[\n\r,;，；]+/)
    .map((item) => item.trim())
    .filter(Boolean).length,
);

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '未知大小';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function scanTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', { hour12: false });
}
</script>

<template>
  <section class="channel-inbox-card" :class="{ enabled: channel.inboxEnabled }">
    <div class="channel-inbox-head">
      <div>
        <div class="setting-label">关键词收件</div>
        <p>关键词同时用于下载目录筛选和拖到 EXE / 工作区空白处时的自动通道路由。</p>
      </div>
      <label class="inline-switch">
        <span>{{ channel.inboxEnabled ? '已启用' : '未启用' }}</span>
        <input v-model="channel.inboxEnabled" type="checkbox" />
      </label>
    </div>

    <div class="channel-inbox-grid">
      <label class="settings-field inbox-directory-field">
        <span>扫描目录</span>
        <div class="path-row">
          <input v-model.trim="channel.inboxDirectory" class="path-input" placeholder="选择下载目录或其他收件目录" />
          <button class="path-browse" type="button" title="选择目录" @click="store.browseInboxDirectory(channel.id)">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
          </button>
        </div>
      </label>
      <div class="inbox-directory-actions">
        <button class="btn btn-ghost btn-sm" type="button" @click="store.useSystemDownloadsForChannel(channel.id)">系统下载目录</button>
        <button class="btn btn-ghost btn-sm" type="button" :disabled="!channel.inboxDirectory.trim()" @click="store.openInboxDirectory(channel.id)">打开目录</button>
        <button
          class="btn btn-primary btn-sm"
          type="button"
          :disabled="scanning || !channel.inboxDirectory.trim() || keywordCount === 0"
          @click="store.scanChannelInbox(channel.id)"
        >{{ scanning ? '扫描中…' : (store.appSettings.keywordScanAutoAdd ? '扫描并加入最新版' : '扫描候选') }}</button>
      </div>

      <label class="settings-field inbox-keyword-field">
        <span>通道关键词</span>
        <textarea
          v-model="channel.inboxKeywords"
          class="option-input inbox-keywords"
          rows="2"
          maxlength="500"
          placeholder="例如：project-name, windows, x64"
        />
        <small>支持逗号、分号或换行；当前 {{ keywordCount }} 个关键词。首次导入可自动填写。</small>
      </label>

      <div class="inbox-option-grid">
        <label class="settings-field">
          <span>匹配方式</span>
          <select v-model="channel.inboxMatchMode" class="option-input">
            <option value="all">包含全部关键词</option>
            <option value="any">包含任一关键词</option>
          </select>
        </label>
        <label class="switch-row compact-switch"><span><b>扫描子目录</b><small>最多向下扫描 12 层</small></span><input v-model="channel.inboxRecursive" type="checkbox" /></label>
        <label class="switch-row compact-switch"><span><b>优先最高版本</b><small>按数字版本比较，无法识别时按修改时间</small></span><input v-model="channel.inboxPreferHighestVersion" type="checkbox" /></label>
        <label class="switch-row compact-switch"><span><b>允许预发布版本</b><small>包含 alpha、beta、rc、preview 等文件</small></span><input v-model="channel.inboxIncludePrerelease" type="checkbox" /></label>
      </div>
    </div>

    <div v-if="result" class="inbox-result" :class="{ empty: !result.selectedPath }">
      <div class="inbox-result-summary">
        <div>
          <b>{{ result.selectionReason }}</b>
          <span>扫描 {{ result.scannedFiles }} 个文件 · 匹配 {{ result.matchedFiles }} 个 · {{ scanTime(result.scannedAt) }}</span>
        </div>
        <span v-if="result.selectedName" class="latest-version-badge">{{ selectedAlreadyAdded ? '已选最新版' : '推荐最新版' }}</span>
      </div>
      <div v-if="result.candidates.length" class="inbox-candidate-list">
        <button
          v-for="candidate in result.candidates.slice(0, 5)"
          :key="candidate.path"
          class="inbox-candidate"
          type="button"
          :class="{ selected: candidate.path === result.selectedPath }"
          :title="candidate.path"
          @click="store.importInboxCandidate(channel.id, candidate.path)"
        >
          <span>
            <b>{{ candidate.name }}</b>
            <small>{{ candidate.format }} · {{ formatSize(candidate.size) }}<template v-if="candidate.versionLabel"> · v{{ candidate.versionLabel }}</template></small>
          </span>
          <em>{{ candidate.path === result.selectedPath ? (channel.files.some((file) => file.path === candidate.path) ? '当前选择' : '推荐选择') : '加入队列' }}</em>
        </button>
      </div>
      <details v-if="result.candidates.length > 5" class="inbox-more-candidates">
        <summary>查看其余 {{ result.candidates.length - 5 }} 个候选</summary>
        <div class="inbox-candidate-list inbox-candidate-list-more">
          <button
            v-for="candidate in result.candidates.slice(5)"
            :key="candidate.path"
            class="inbox-candidate"
            type="button"
            :class="{ selected: candidate.path === result.selectedPath }"
            :title="candidate.path"
            @click="store.importInboxCandidate(channel.id, candidate.path)"
          >
            <span>
              <b>{{ candidate.name }}</b>
              <small>{{ candidate.format }} · {{ formatSize(candidate.size) }}<template v-if="candidate.versionLabel"> · v{{ candidate.versionLabel }}</template></small>
            </span>
            <em>{{ candidate.path === result.selectedPath ? '推荐选择' : '加入队列' }}</em>
          </button>
        </div>
      </details>
      <div class="inbox-result-actions">
        <button class="btn btn-ghost btn-sm" type="button" @click="store.openInboxDirectory(channel.id)">打开扫描目录</button>
        <button class="btn btn-ghost btn-sm" type="button" @click="store.clearInboxScanResult(channel.id)">清除结果</button>
      </div>
    </div>
  </section>
</template>
