<script setup lang="ts">
import { computed } from 'vue';
import { useChannelStore } from '../../stores/channels';

const store = useChannelStore();
const enabledCount = computed(() => store.channels.filter((channel) => channel.inboxEnabled).length);
const configuredCount = computed(() => store.channels.filter((channel) =>
  channel.inboxEnabled && channel.inboxDirectory.trim() && channel.inboxKeywords.trim(),
).length);
const scanning = computed(() => store.inboxScanningIds.length > 0);
</script>

<template>
  <section class="settings-section">
    <div class="settings-section-head">
      <div>
        <h3>下载目录关键词收件</h3>
        <p>每个通道可以使用独立关键词扫描指定目录；多个匹配文件默认按数字版本选择最高版本。</p>
      </div>
      <button class="btn btn-primary btn-sm" type="button" :disabled="scanning || configuredCount === 0" @click="store.scanAllKeywordChannels()">
        {{ scanning ? `扫描中（${store.inboxScanningIds.length}）` : `扫描全部（${configuredCount}）` }}
      </button>
    </div>

    <div class="inbox-overview-grid">
      <article class="inbox-overview-card"><b>{{ enabledCount }}</b><span>已启用通道</span></article>
      <article class="inbox-overview-card"><b>{{ configuredCount }}</b><span>可立即扫描</span></article>
      <article class="inbox-overview-card"><b>{{ store.appSettings.keywordScanMaxCandidates }}</b><span>保留候选上限</span></article>
    </div>
  </section>

  <section class="settings-section settings-two-column">
    <div class="settings-panel">
      <h3>新通道默认值</h3>
      <label class="settings-field">
        <span>默认收件目录</span>
        <div class="path-row">
          <input v-model.trim="store.appSettings.defaultInboxDirectory" class="path-input" placeholder="可选择系统下载目录" />
          <button class="path-browse" type="button" title="选择目录" @click="store.browseDefaultInboxDirectory">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
          </button>
        </div>
      </label>
      <div class="maintenance-actions">
        <button class="btn btn-sm" type="button" @click="store.useSystemDownloadsAsDefault">使用系统下载目录</button>
        <button class="btn btn-ghost btn-sm" type="button" @click="store.appSettings.defaultInboxDirectory = ''">清空默认目录</button>
      </div>
      <label class="settings-field">
        <span>默认匹配方式</span>
        <select v-model="store.appSettings.defaultInboxMatchMode" class="option-input">
          <option value="all">文件名包含全部关键词</option>
          <option value="any">文件名包含任一关键词</option>
        </select>
      </label>
      <label class="switch-row"><span><b>默认扫描子目录</b><small>最多递归 12 层</small></span><input v-model="store.appSettings.defaultInboxRecursive" type="checkbox" /></label>
      <label class="switch-row"><span><b>默认选择最高版本</b><small>按 2.10.3 这类数字序列比较</small></span><input v-model="store.appSettings.defaultPreferHighestVersion" type="checkbox" /></label>
      <label class="switch-row"><span><b>默认包含预发布版本</b><small>包含 alpha、beta、rc、preview 等</small></span><input v-model="store.appSettings.defaultIncludePrerelease" type="checkbox" /></label>
      <button class="btn btn-ghost btn-sm" type="button" @click="store.applyInboxDefaultsToChannels">将默认选项应用到现有通道</button>
    </div>

    <div class="settings-panel">
      <h3>扫描与队列行为</h3>
      <label class="switch-row"><span><b>首次导入自动提取关键词</b><small>通道还没有关键词时，从第一个支持的压缩包文件名提取稳定关键词</small></span><input v-model="store.appSettings.autoLearnChannelKeywords" type="checkbox" /></label>
      <label class="switch-row"><span><b>拖到 EXE / 工作区自动分配通道</b><small>根据各通道关键词匹配文件名；匹配后继续执行该通道的自动开始等设置</small></span><input v-model="store.appSettings.autoRouteDroppedFiles" type="checkbox" /></label>
      <label class="settings-field">
        <span>候选保留数量</span>
        <span class="range-field appearance-range">
          <input v-model.number="store.appSettings.keywordScanMaxCandidates" type="range" min="5" max="200" step="5" />
          <output>{{ store.appSettings.keywordScanMaxCandidates }}</output>
        </span>
        <small class="range-help">只影响结果列表数量；最高版本会在截断前完成选择。</small>
      </label>
      <label class="switch-row"><span><b>启动时自动扫描</b><small>应用连接后扫描所有已启用且配置完整的通道</small></span><input v-model="store.appSettings.autoScanKeywordChannelsOnLaunch" type="checkbox" /></label>
      <label class="switch-row"><span><b>扫描后自动加入推荐文件</b><small>关闭后“扫描收件”只展示候选；主界面的“扫描最新版并开始”仍会直接加入并启动</small></span><input v-model="store.appSettings.keywordScanAutoAdd" type="checkbox" /></label>
      <label class="switch-row danger-setting"><span><b>扫描结果替换待处理队列</b><small>移除未开始和已结束的队列项；正在运行或暂停的任务不会被影响</small></span><input v-model="store.appSettings.keywordScanReplaceQueue" type="checkbox" /></label>
      <div class="setting-note">
        <b>版本选择规则</b>
        <span>优先识别文件名中的 version、release、版本、ver、v 后的数字；无法识别时按最后修改时间。</span>
        <small>例如 project-v2.10.0.zip 会高于 project-v2.9.9.zip。</small>
      </div>
    </div>
  </section>

  <section class="settings-section warning-section">
    <div class="settings-section-head">
      <div>
        <h3>使用提示</h3>
        <p>关键词只匹配文件名，不读取压缩包内容。首次导入可自动提取；之后把新版本拖到 EXE 或工作区空白处，会优先按这些关键词进入对应通道。</p>
      </div>
    </div>
  </section>
</template>
