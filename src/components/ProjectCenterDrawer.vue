<script setup lang="ts">
import { ref } from 'vue';
import { openOutput, pickDirectory } from '../services/tauri';
import { useChannelStore } from '../stores/channels';
import { useProjectCenterStore } from '../stores/projectCenter';
import type { ProjectRecord, ProjectStatus } from '../types';

const workspace = useChannelStore();
const projects = useProjectCenterStore();
const busyIds = ref<string[]>([]);
const adding = ref(false);

const statusLabels: Record<ProjectStatus, string> = {
  active: '进行中',
  paused: '已暂停',
  archived: '已归档',
};

function formatTime(value?: string): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function isBusy(id: string): boolean {
  return busyIds.value.includes(id);
}

async function runBusy(project: ProjectRecord, action: () => Promise<void>): Promise<void> {
  if (isBusy(project.id)) return;
  busyIds.value = [...busyIds.value, project.id];
  try {
    await action();
  } finally {
    busyIds.value = busyIds.value.filter((id) => id !== project.id);
  }
}

async function addProject(): Promise<void> {
  if (adding.value) return;
  adding.value = true;
  try {
    const path = await pickDirectory(workspace.appSettings.claudeToolsDirectory || undefined);
    if (!path) return;
    const result = projects.addOrUpdateProject({ path });
    if (!result) return;
    workspace.pushToast({
      level: result.created ? 'success' : 'info',
      title: result.created ? '项目已加入项目中心' : '项目记录已更新',
      message: result.record.path,
    });
  } catch (error) {
    workspace.pushToast({ level: 'error', title: '无法添加项目目录', message: String(error) });
  } finally {
    adding.value = false;
  }
}

async function openProject(project: ProjectRecord): Promise<void> {
  await runBusy(project, async () => {
    try {
      await openOutput(project.path);
      projects.recordOpened(project.id);
    } catch (error) {
      workspace.pushToast({ level: 'error', title: '无法打开项目目录', message: String(error) });
    }
  });
}

async function copyPath(project: ProjectRecord): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(project.path);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = project.path;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    workspace.pushToast({ level: 'success', title: '项目路径已复制', message: project.path });
  } catch (error) {
    workspace.pushToast({ level: 'error', title: '复制路径失败', message: String(error) });
  }
}

async function generateDat(project: ProjectRecord): Promise<void> {
  await runBusy(project, () => workspace.generateClaudeDatAt(project.path));
}

async function launchClaude(project: ProjectRecord): Promise<void> {
  await runBusy(project, async () => {
    const launched = await workspace.launchClaudeAt(project.path);
    if (launched) projects.recordOpened(project.id);
  });
}


function updateName(project: ProjectRecord, event: Event): void {
  projects.updateProject(project.id, { name: (event.target as HTMLInputElement).value });
}

function updateStatus(project: ProjectRecord, event: Event): void {
  projects.updateProject(project.id, { status: (event.target as HTMLSelectElement).value as ProjectStatus });
}

function updateNote(project: ProjectRecord, event: Event): void {
  projects.updateProject(project.id, { note: (event.target as HTMLInputElement).value });
}

function updateTags(project: ProjectRecord, event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  projects.updateProject(project.id, { tags: value.split(/[,，]/) });
}

function clearArchivedProjects(): void {
  const count = projects.projects.filter((project) => project.status === 'archived' && !project.pinned).length;
  if (!count) return;
  if (!window.confirm(`清理 ${count} 个未置顶的归档项目吗？
不会删除磁盘上的项目文件。`)) return;
  projects.clearArchived();
  workspace.pushToast({ level: 'info', title: '归档项目记录已清理', message: `移除 ${count} 条记录` });
}

function removeProject(project: ProjectRecord): void {
  if (!window.confirm(`从项目中心移除“${project.name}”吗？\n不会删除磁盘上的项目文件。`)) return;
  projects.removeProject(project.id);
}
</script>

<template>
  <div v-if="projects.drawerOpen" class="drawer-backdrop" @mousedown.self="projects.drawerOpen = false">
    <aside class="project-drawer" role="dialog" aria-modal="true" aria-labelledby="project-center-title">
      <header class="drawer-head">
        <div>
          <h2 id="project-center-title">项目中心</h2>
          <p>集中管理解压项目、状态、标签、备注与 Claude 启动入口</p>
        </div>
        <div class="drawer-actions">
          <span class="project-count-badge">{{ projects.activeCount }} 个进行中</span>
          <button class="btn btn-primary btn-sm" type="button" :disabled="adding" @click="addProject">{{ adding ? '选择中…' : '添加项目' }}</button>
          <button class="btn btn-ghost" type="button" @click="projects.drawerOpen = false">关闭</button>
        </div>
      </header>

      <div class="project-toolbar">
        <label class="search-box project-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <input v-model="projects.search" type="search" placeholder="搜索项目名、路径、标签、备注或来源" />
        </label>
        <select v-model="projects.filter" class="toolbar-select" aria-label="筛选项目状态">
          <option value="all">全部项目</option>
          <option value="pinned">已置顶</option>
          <option value="active">进行中</option>
          <option value="paused">已暂停</option>
          <option value="archived">已归档</option>
        </select>
        <button v-if="projects.archivedCount" class="btn btn-ghost btn-sm" type="button" @click="clearArchivedProjects">清理未置顶归档</button>
      </div>

      <div class="project-summary-strip">
        <span><b>{{ projects.projects.length }}</b> 个项目</span>
        <span><b>{{ projects.pinnedCount }}</b> 个置顶</span>
        <span>成功解压后的输出目录会自动收录；重复路径只更新最近活动。</span>
      </div>

      <div v-if="projects.visibleProjects.length" class="project-list">
        <article v-for="project in projects.visibleProjects" :key="project.id" class="project-card" :data-status="project.status" :class="{ pinned: project.pinned }">
          <div class="project-card-head">
            <button class="project-pin" type="button" :class="{ active: project.pinned }" :title="project.pinned ? '取消置顶' : '置顶项目'" @click="projects.togglePin(project.id)">★</button>
            <div class="project-title-edit">
              <input
                :value="project.name"
                maxlength="120"
                aria-label="项目名称"
                @change="updateName(project, $event)"
              />
              <code :title="project.path">{{ project.path }}</code>
            </div>
            <select
              class="project-status-select"
              :value="project.status"
              aria-label="项目状态"
              @change="updateStatus(project, $event)"
            >
              <option value="active">进行中</option>
              <option value="paused">已暂停</option>
              <option value="archived">已归档</option>
            </select>
          </div>

          <div class="project-fields">
            <label>
              <span>标签</span>
              <input :value="project.tags.join(', ')" maxlength="160" placeholder="例如：前端, Windows, 待测试" @change="updateTags(project, $event)" />
            </label>
            <label>
              <span>备注</span>
              <input :value="project.note" maxlength="500" placeholder="下一步、负责人或风险说明" @change="updateNote(project, $event)" />
            </label>
          </div>

          <dl class="project-meta">
            <div><dt>状态</dt><dd>{{ statusLabels[project.status] }}</dd></div>
            <div><dt>最近更新</dt><dd>{{ formatTime(project.updatedAt) }}</dd></div>
            <div><dt>最近打开</dt><dd>{{ formatTime(project.lastOpenedAt) }}</dd></div>
            <div v-if="project.sourceChannelName"><dt>来源通道</dt><dd>{{ project.sourceChannelName }}</dd></div>
            <div v-if="project.sourceFileName"><dt>来源文件</dt><dd :title="project.sourceFileName">{{ project.sourceFileName }}</dd></div>
          </dl>

          <div class="project-actions" :aria-busy="isBusy(project.id)">
            <button class="btn btn-primary btn-sm" type="button" :disabled="isBusy(project.id)" @click="openProject(project)">打开目录</button>
            <button class="btn btn-sm" type="button" :disabled="isBusy(project.id)" @click="launchClaude(project)">用 DAT 打开 Claude</button>
            <button class="btn btn-sm" type="button" :disabled="isBusy(project.id)" @click="generateDat(project)">生成 DAT</button>
            <button class="btn btn-ghost btn-sm" type="button" @click="copyPath(project)">复制路径</button>
            <button class="btn btn-ghost btn-sm danger-hover" type="button" :disabled="isBusy(project.id)" @click="removeProject(project)">移除</button>
          </div>
        </article>
      </div>

      <div v-else class="project-empty">
        <b>{{ projects.projects.length ? '没有匹配的项目' : '项目中心还是空的' }}</b>
        <span>{{ projects.projects.length ? '调整搜索或筛选条件后再试。' : '成功解压后会自动收录，也可以手动添加任意项目目录。' }}</span>
        <button v-if="!projects.projects.length" class="btn btn-primary btn-sm" type="button" :disabled="adding" @click="addProject">添加第一个项目</button>
        <button v-else class="btn btn-sm" type="button" @click="projects.search = ''; projects.filter = 'all'">清除筛选</button>
      </div>
    </aside>
  </div>
</template>
