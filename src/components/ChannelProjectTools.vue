<script setup lang="ts">
import { computed, ref } from 'vue';
import { useChannelStore } from '../stores/channels';
import { displayPath } from '../utils/path';
import type { Channel } from '../types';

const props = defineProps<{ channel: Channel }>();
const store = useChannelStore();
const busy = ref(false);
const claudeDirectory = computed(() => store.channelClaudeDirectory(props.channel.id));

async function run(action: 'generate' | 'launch'): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  try {
    if (action === 'generate') await store.generateClaudeDatForChannel(props.channel.id);
    else await store.launchClaudeForChannel(props.channel.id);
  } finally {
    busy.value = false;
  }
}

async function changeAutoLaunch(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement | null;
  if (!input) return;
  if (!input.checked) {
    props.channel.autoLaunchClaudeAfterExtract = false;
    return;
  }

  const accepted = window.confirm(
    `启用后，“${props.channel.name}”每个压缩包成功解压时，都会在实际输出目录自动运行：\n\nclaude --dangerously-skip-permissions\n\n该参数会跳过权限确认，自动启动时不会再次弹窗。只应对完全可信的压缩包和项目启用。确定继续吗？`,
  );
  if (!accepted) {
    input.checked = false;
    props.channel.autoLaunchClaudeAfterExtract = false;
    return;
  }

  props.channel.autoLaunchClaudeAfterExtract = true;
  const status = await store.checkClaudeAvailability(false);
  store.pushToast(status?.available
    ? {
        level: 'warn',
        title: '已启用解压完成后自动运行 Claude',
        message: '将使用每个任务的实际输出目录；同一目录 8 秒内只启动一个窗口。',
        timeoutMs: 7000,
      }
    : {
        level: 'warn',
        title: '已启用自动启动，但当前未找到 Claude CLI',
        message: status?.message || '请在“总设置 → 项目工具”中检测或安装 npm Claude CLI。',
        timeoutMs: 9000,
      });
}
</script>

<template>
  <div class="channel-automation-actions">
    <div>
      <b>项目辅助工具</b>
      <span v-if="claudeDirectory">Claude DAT 将直接使用当前通道的解压目录：{{ displayPath(claudeDirectory) }}</span>
      <span v-else>请先设置“指定目录”，或在“跟随压缩包”模式下加入压缩包；这里不会再弹出额外的目录选择器。</span>
      <label
        class="switch-row compact-switch project-auto-launch-switch"
        :class="{ enabled: channel.autoLaunchClaudeAfterExtract }"
        title="成功解压后，在实际输出目录自动启动 Claude，并跳过权限确认"
      >
        <span>
          <b>解压完成后自动运行 Claude</b>
          <small>执行 claude --dangerously-skip-permissions；同一输出目录 8 秒内只启动一次</small>
        </span>
        <input
          :checked="channel.autoLaunchClaudeAfterExtract"
          type="checkbox"
          aria-label="解压完成后自动运行 Claude"
          @change="changeAutoLaunch"
        />
      </label>
    </div>
    <div class="detail-actions" :aria-busy="busy">
      <button
        class="btn btn-sm"
        type="button"
        :disabled="busy"
        :title="claudeDirectory ? '在当前通道配置的解压目录中生成或更新项目 DAT' : '请先配置通道解压目录'"
        @click="run('generate')"
      >{{ busy ? '处理中…' : '生成 Claude DAT' }}</button>
      <button
        class="btn btn-sm"
        type="button"
        :disabled="busy"
        :title="claudeDirectory ? '使用或生成项目 DAT，并在当前通道配置的解压目录启动 Claude' : '请先配置通道解压目录'"
        @click="run('launch')"
      >{{ busy ? '处理中…' : '用 DAT 打开 Claude' }}</button>
      <button
        class="btn btn-ghost btn-sm danger-hover"
        type="button"
        :disabled="!channel.files.some((file) => file.manifestPath && !file.outputDeleted)"
        @click="store.deleteChannelOutputs(channel.id)"
      >删除解压文件</button>
    </div>
  </div>
</template>
