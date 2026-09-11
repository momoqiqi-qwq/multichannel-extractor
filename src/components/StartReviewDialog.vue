<script setup lang="ts">
import { computed } from 'vue';
import { useChannelStore } from '../stores/channels';

const store = useChannelStore();
const review = computed(() => store.startReview);
const totalIssues = computed(() => {
  const current = review.value;
  if (!current) return 0;
  return current.localIssues.length + current.preflight.jobs.reduce((sum, job) => sum + job.issues.length, 0);
});
const warningCount = computed(() => {
  const current = review.value;
  if (!current) return 0;
  return current.preflight.warningCount + current.localIssues.filter((issue) => issue.severity === 'warning').length;
});
const blockingCount = computed(() => {
  const current = review.value;
  if (!current) return 0;
  return current.preflight.blockingIssueCount + current.localIssues.filter((issue) => issue.severity === 'error').length;
});

function formatBytes(value?: number): string {
  if (value == null || !Number.isFinite(value)) return '未知';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let amount = Math.max(0, value);
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  return `${amount.toFixed(index < 2 ? 0 : 1)} ${units[index]}`;
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function pathSegments(path?: string): string[] {
  if (!path) return ['无法规划'];
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  const drive = /^[A-Za-z]:/.test(parts[0] || '') ? parts.shift() : undefined;
  const visible = parts.length > 6 ? ['…', ...parts.slice(-6)] : parts;
  return drive ? [drive, ...visible] : visible;
}

function modeLabel(index: number): string {
  const job = review.value?.jobs[index];
  if (!job) return '';
  const depth = job.depthMode.type === 'flatten' ? `保留 ${job.depthMode.depth} 层` : job.depthMode.type === 'skipOuter' ? '跳过外层' : '保留结构';
  return `${job.createArchiveSubfolder ? '同名文件夹' : '直接写入'} · ${depth} · ${job.collisionPolicy === 'overwrite' ? '替换同名' : job.collisionPolicy === 'rename' ? '自动改名' : '跳过同名'}`;
}

function exampleOutput(index: number, outputPath?: string): string {
  const job = review.value?.jobs[index];
  if (!job || !outputPath) return '无法生成示例';
  const sample = ['根目录', '资料', '图片', '示例文件.txt'];
  let mapped = sample;
  if (job.depthMode.type === 'skipOuter') mapped = sample.slice(1);
  if (job.depthMode.type === 'flatten') {
    const file = sample[sample.length - 1];
    mapped = [...sample.slice(0, Math.max(0, job.depthMode.depth)), file];
  }
  const separator = outputPath.includes('\\') ? '\\' : '/';
  return [outputPath.replace(/[\\/]+$/, ''), ...mapped].join(separator);
}
</script>

<template>
  <div v-if="review" class="drawer-backdrop start-review-backdrop" role="presentation" @mousedown.self="store.cancelStartReview">
    <section class="start-review-dialog" role="dialog" aria-modal="true" aria-labelledby="start-review-title">
      <header class="drawer-head">
        <div>
          <h2 id="start-review-title">{{ review.title }}</h2>
          <p>确认源文件、输出目录、冲突策略与磁盘空间，再提交任务。</p>
        </div>
        <button class="btn btn-ghost btn-sm" type="button" @click="store.cancelStartReview">返回修改</button>
      </header>

      <div class="start-review-summary">
        <span class="review-stat ok"><b>{{ review.jobs.length }}</b> 个任务</span>
        <span class="review-stat" :class="warningCount ? 'warn' : 'ok'"><b>{{ warningCount }}</b> 个警告</span>
        <span class="review-stat" :class="blockingCount ? 'error' : 'ok'"><b>{{ blockingCount }}</b> 个阻止项</span>
        <span class="review-stat"><b>{{ totalIssues }}</b> 条检查信息</span>
      </div>

      <div v-if="review.localIssues.length" class="review-global-issues">
        <div v-for="issue in review.localIssues" :key="issue.code" class="review-issue" :data-severity="issue.severity">
          <b>{{ issue.severity === 'error' ? '错误' : issue.severity === 'warning' ? '注意' : '提示' }}</b>
          <span>{{ issue.message }}</span>
        </div>
      </div>

      <div class="start-review-list">
        <article v-for="(result, index) in review.preflight.jobs" :key="result.jobId" class="start-review-job">
          <div class="review-tree">
            <div class="review-tree-node source">
              <span>源文件</span>
              <b :title="result.archivePath">{{ fileName(result.archivePath) }}</b>
              <code>{{ result.archivePath }}</code>
            </div>
            <div class="review-tree-arrow" aria-hidden="true">→</div>
            <div class="review-tree-node destination">
              <span>最终输出根目录</span>
              <b :title="result.outputPath || '无法规划'">{{ result.outputPath || '无法规划输出目录' }}</b>
              <div class="review-output-branches" aria-label="输出路径树">
                <span v-for="(segment, segmentIndex) in pathSegments(result.outputPath)" :key="`${result.jobId}-${segmentIndex}`" :style="{ '--tree-indent': `${Math.min(segmentIndex, 5) * 10}px` }">{{ segment }}</span>
              </div>
              <small>{{ modeLabel(index) }}</small>
              <code class="review-example-path" :title="exampleOutput(index, result.outputPath)">示例落地：{{ exampleOutput(index, result.outputPath) }}</code>
            </div>
          </div>
          <div class="review-capacity">
            <span>压缩包 {{ formatBytes(result.archiveSize) }}</span>
            <span>预计临时与输出空间 {{ formatBytes(result.estimatedRequiredBytes) }}</span>
            <span>目标磁盘可用 {{ formatBytes(result.availableBytes) }}</span>
          </div>
          <div v-if="result.issues.length" class="review-job-issues">
            <div v-for="issue in result.issues" :key="`${result.jobId}-${issue.code}`" class="review-issue" :data-severity="issue.severity">
              <b>{{ issue.severity === 'error' ? '错误' : issue.severity === 'warning' ? '注意' : '提示' }}</b>
              <span>{{ issue.message }}</span>
            </div>
          </div>
          <div v-else class="review-clean">检查通过，可以开始。</div>
        </article>
      </div>

      <footer class="start-review-actions">
        <label class="switch-row compact-switch">
          <span><b>下次仍显示输出预览</b><small>可在“设置 → 自检与恢复”中修改</small></span>
          <input v-model="store.appSettings.showOutputPreviewBeforeStart" type="checkbox" />
        </label>
        <div>
          <button class="btn" type="button" @click="store.cancelStartReview">取消</button>
          <button class="btn btn-primary" type="button" :disabled="blockingCount > 0" @click="store.confirmStartReview">
            {{ blockingCount ? '请先修复阻止项' : `确认开始 ${review.jobs.length} 个任务` }}
          </button>
        </div>
      </footer>
    </section>
  </div>
</template>
