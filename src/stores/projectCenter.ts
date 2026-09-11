import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { readJson, writeJson } from '../services/persistence';
import { normalizePathInput } from '../utils/path';
import type { ProjectRecord, ProjectStatus } from '../types';

const PROJECTS_KEY = 'multichannel-extractor-projects-v1';
const MAX_PROJECTS = 300;

export interface ProjectRecordInput {
  path: string;
  name?: string;
  sourceChannelId?: string;
  sourceChannelName?: string;
  sourceFileName?: string;
  extractedAt?: string;
}

function createProjectId(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `project-${random}`;
}

function pathKey(path: string): string {
  return normalizePathInput(path).replace(/[\\/]+$/, '').replace(/\\/g, '/').toLocaleLowerCase();
}

function baseName(path: string): string {
  const normalized = normalizePathInput(path).replace(/[\\/]+$/, '');
  const index = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  return normalized.slice(index + 1) || normalized;
}

function stripArchiveExtension(value: string): string {
  return value.replace(/\.(tar\.(gz|bz2|xz)|zip|rar|7z|tgz|tbz2|txz|gz|bz2|xz)$/i, '');
}

function normalizeStatus(value: unknown): ProjectStatus {
  return value === 'paused' || value === 'archived' ? value : 'active';
}

function normalizeRecord(raw: Partial<ProjectRecord>): ProjectRecord | null {
  const path = normalizePathInput(String(raw.path || ''));
  if (!path) return null;
  const now = new Date().toISOString();
  return {
    id: String(raw.id || createProjectId()),
    name: String(raw.name || baseName(path)).trim().slice(0, 120) || baseName(path),
    path,
    status: normalizeStatus(raw.status),
    pinned: Boolean(raw.pinned),
    note: String(raw.note || '').trim().slice(0, 500),
    tags: Array.isArray(raw.tags)
      ? raw.tags.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 12)
      : [],
    sourceChannelId: raw.sourceChannelId ? String(raw.sourceChannelId) : undefined,
    sourceChannelName: raw.sourceChannelName ? String(raw.sourceChannelName) : undefined,
    sourceFileName: raw.sourceFileName ? String(raw.sourceFileName) : undefined,
    createdAt: String(raw.createdAt || now),
    updatedAt: String(raw.updatedAt || raw.createdAt || now),
    lastOpenedAt: raw.lastOpenedAt ? String(raw.lastOpenedAt) : undefined,
    lastExtractedAt: raw.lastExtractedAt ? String(raw.lastExtractedAt) : undefined,
  };
}

function loadProjects(): ProjectRecord[] {
  const parsed = readJson<unknown>([PROJECTS_KEY]);
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<string>();
  return parsed
    .map((item) => normalizeRecord(item as Partial<ProjectRecord>))
    .filter((item): item is ProjectRecord => Boolean(item))
    .filter((item) => {
      const key = pathKey(item.path);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_PROJECTS);
}

export const useProjectCenterStore = defineStore('projectCenter', () => {
  const drawerOpen = ref(false);
  const projects = ref<ProjectRecord[]>(loadProjects());
  const search = ref('');
  const filter = ref<'all' | ProjectStatus | 'pinned'>('all');
  let persistTimer: ReturnType<typeof setTimeout> | null = null;

  const activeCount = computed(() => projects.value.filter((project) => project.status === 'active').length);
  const pinnedCount = computed(() => projects.value.filter((project) => project.pinned).length);
  const archivedCount = computed(() => projects.value.filter((project) => project.status === 'archived').length);
  const visibleProjects = computed(() => {
    const query = search.value.trim().toLocaleLowerCase();
    return [...projects.value]
      .filter((project) => {
        const matchesFilter = filter.value === 'all'
          || (filter.value === 'pinned' ? project.pinned : project.status === filter.value);
        if (!matchesFilter) return false;
        if (!query) return true;
        return [
          project.name,
          project.path,
          project.note,
          project.tags.join(' '),
          project.sourceChannelName || '',
          project.sourceFileName || '',
        ].some((value) => value.toLocaleLowerCase().includes(query));
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (a.status !== b.status) {
          const order: Record<ProjectStatus, number> = { active: 0, paused: 1, archived: 2 };
          return order[a.status] - order[b.status];
        }
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  });

  function persist(): void {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      writeJson(PROJECTS_KEY, projects.value.slice(0, MAX_PROJECTS));
      persistTimer = null;
    }, 180);
  }

  watch(projects, persist, { deep: true });

  function addOrUpdateProject(input: ProjectRecordInput): { record: ProjectRecord; created: boolean } | null {
    const path = normalizePathInput(input.path);
    if (!path) return null;
    const key = pathKey(path);
    const now = new Date().toISOString();
    const existing = projects.value.find((project) => pathKey(project.path) === key);
    if (existing) {
      existing.path = path;
      if (input.name?.trim()) existing.name = input.name.trim().slice(0, 120);
      if (input.sourceChannelId) existing.sourceChannelId = input.sourceChannelId;
      if (input.sourceChannelName) existing.sourceChannelName = input.sourceChannelName;
      if (input.sourceFileName) existing.sourceFileName = input.sourceFileName;
      if (input.extractedAt) existing.lastExtractedAt = input.extractedAt;
      existing.updatedAt = now;
      return { record: existing, created: false };
    }

    const suggestedName = input.name?.trim()
      || (input.sourceFileName ? stripArchiveExtension(input.sourceFileName) : '')
      || baseName(path)
      || '未命名项目';
    const record: ProjectRecord = {
      id: createProjectId(),
      name: suggestedName.slice(0, 120),
      path,
      status: 'active',
      pinned: false,
      note: '',
      tags: [],
      sourceChannelId: input.sourceChannelId,
      sourceChannelName: input.sourceChannelName,
      sourceFileName: input.sourceFileName,
      createdAt: now,
      updatedAt: now,
      lastExtractedAt: input.extractedAt,
    };
    projects.value.unshift(record);
    if (projects.value.length > MAX_PROJECTS) {
      const removable = [...projects.value]
        .filter((project) => !project.pinned)
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
      while (projects.value.length > MAX_PROJECTS && removable.length) {
        const candidate = removable.shift();
        if (candidate) projects.value = projects.value.filter((project) => project.id !== candidate.id);
      }
    }
    return { record, created: true };
  }

  function updateProject(id: string, patch: Partial<Pick<ProjectRecord, 'name' | 'note' | 'tags' | 'status' | 'pinned'>>): void {
    const project = projects.value.find((item) => item.id === id);
    if (!project) return;
    if (patch.name !== undefined) project.name = patch.name.trim().slice(0, 120) || baseName(project.path);
    if (patch.note !== undefined) project.note = patch.note.trim().slice(0, 500);
    if (patch.tags !== undefined) project.tags = patch.tags.map((item) => item.trim()).filter(Boolean).slice(0, 12);
    if (patch.status !== undefined) project.status = normalizeStatus(patch.status);
    if (patch.pinned !== undefined) project.pinned = patch.pinned;
    project.updatedAt = new Date().toISOString();
  }

  function togglePin(id: string): void {
    const project = projects.value.find((item) => item.id === id);
    if (project) updateProject(id, { pinned: !project.pinned });
  }

  function recordOpened(id: string): void {
    const project = projects.value.find((item) => item.id === id);
    if (!project) return;
    const now = new Date().toISOString();
    project.lastOpenedAt = now;
    project.updatedAt = now;
  }

  function removeProject(id: string): void {
    projects.value = projects.value.filter((project) => project.id !== id);
  }

  function clearArchived(): void {
    projects.value = projects.value.filter((project) => project.status !== 'archived' || project.pinned);
  }

  return {
    drawerOpen,
    projects,
    search,
    filter,
    activeCount,
    pinnedCount,
    archivedCount,
    visibleProjects,
    addOrUpdateProject,
    updateProject,
    togglePin,
    recordOpened,
    removeProject,
    clearArchived,
  };
});
