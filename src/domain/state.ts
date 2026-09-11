import { categoryDefinition, DEFAULT_APP_SETTINGS } from '../config/appearance';
import { normalizePathInput } from '../utils/path';
import type {
  AppSettings,
  Channel,
  ChannelCategory,
  ChannelPreset,
  ChannelSortMode,
  BackgroundFitMode,
  BackgroundPositionMode,
  CollisionPolicy,
  ConfigurationBundle,
  DensityMode,
  DepthModeType,
  DuplicateImportPolicy,
  FileSortMode,
  FontPresetId,
  KeywordMatchMode,
  QueueStrategy,
  ThemeId,
  WorkspaceWidthMode,
} from '../types';

export const STORAGE_KEY = 'multichannel-extractor-state-v10';
export const LEGACY_STORAGE_KEYS = [
  'multichannel-extractor-state-v9',
  'multichannel-extractor-state-v8',
  'multichannel-extractor-state-v7',
  'multichannel-extractor-state-v6',
  'multichannel-extractor-state-v5',
  'multichannel-extractor-state-v4',
  'multichannel-extractor-state-v3',
  'multichannel-extractor-state-v2',
  'multichannel-extractor-state-v1',
];
export const PRESET_KEY = 'multichannel-extractor-presets-v10';
export const LEGACY_PRESET_KEYS = [
  'multichannel-extractor-presets-v9',
  'multichannel-extractor-presets-v8',
  'multichannel-extractor-presets-v7',
  'multichannel-extractor-presets-v6',
  'multichannel-extractor-presets-v5',
  'multichannel-extractor-presets-v4',
  'multichannel-extractor-presets-v3',
  'multichannel-extractor-presets-v2',
  'multichannel-extractor-presets-v1',
];

export type PersistedChannel = Omit<Channel, 'files' | 'dragActive' | 'password'>;

export interface PersistedState {
  channels: PersistedChannel[];
  maxConcurrency: number;
  appSettings: AppSettings;
  recentDestinations: string[];
}

export function createId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

function normalizeTheme(value: unknown): ThemeId {
  if (value === 'light') return 'claude-light';
  if (value === 'dark') return 'classic-dark';
  const themes: ThemeId[] = [
    'classic-dark',
    'claude-light',
    'claude-dark',
    'midnight-blue',
    'graphite-black',
    'glass-blue',
    'paper-cream',
    'amethyst',
    'win11',
    'sunset',
    'mint-light',
  ];
  return themes.includes(value as ThemeId) ? (value as ThemeId) : DEFAULT_APP_SETTINGS.theme;
}

export function normalizeCollisionPolicy(value: unknown, fallback: CollisionPolicy = DEFAULT_APP_SETTINGS.defaultCollisionPolicy): CollisionPolicy {
  return ['rename', 'overwrite', 'skip'].includes(String(value)) ? (value as CollisionPolicy) : fallback;
}

export function normalizeFileSort(value: unknown): FileSortMode {
  return ['manual', 'name', 'size', 'status'].includes(String(value)) ? (value as FileSortMode) : 'manual';
}

function normalizeCategory(value: unknown, fallback: ChannelCategory = 'general'): ChannelCategory {
  const categories: ChannelCategory[] = ['general', 'work', 'media', 'delivery', 'backup', 'download', 'encrypted', 'temporary'];
  return categories.includes(value as ChannelCategory) ? (value as ChannelCategory) : fallback;
}

function normalizeDepthMode(value: unknown, fallback: DepthModeType = 'preserve'): DepthModeType {
  return ['preserve', 'flatten', 'skipOuter'].includes(String(value)) ? (value as DepthModeType) : fallback;
}

function normalizeDensity(value: unknown): DensityMode {
  return ['compact', 'comfortable', 'spacious'].includes(String(value)) ? (value as DensityMode) : DEFAULT_APP_SETTINGS.density;
}

function normalizeFontPreset(value: unknown): FontPresetId {
  const presets: FontPresetId[] = ['system', 'microsoft-yahei', 'segoe-ui', 'noto-sans-cjk', 'serif', 'monospace', 'custom'];
  return presets.includes(value as FontPresetId) ? (value as FontPresetId) : DEFAULT_APP_SETTINGS.fontPreset;
}

function normalizeBackgroundFit(value: unknown): BackgroundFitMode {
  return ['cover', 'contain', 'stretch'].includes(String(value))
    ? (value as BackgroundFitMode)
    : DEFAULT_APP_SETTINGS.backgroundFit;
}

function normalizeBackgroundPosition(value: unknown): BackgroundPositionMode {
  return ['center', 'top', 'bottom', 'left', 'right'].includes(String(value))
    ? (value as BackgroundPositionMode)
    : DEFAULT_APP_SETTINGS.backgroundPosition;
}


function normalizeWorkspaceWidth(value: unknown): WorkspaceWidthMode {
  return ['fluid', 'wide', 'focused'].includes(String(value)) ? (value as WorkspaceWidthMode) : DEFAULT_APP_SETTINGS.workspaceWidth;
}

function normalizeChannelSort(value: unknown): ChannelSortMode {
  return ['manual', 'name', 'category', 'status'].includes(String(value)) ? (value as ChannelSortMode) : DEFAULT_APP_SETTINGS.channelSort;
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.round(parsed))) : fallback;
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function normalizeFontWeight(value: unknown): number {
  const parsed = boundedInteger(value, DEFAULT_APP_SETTINGS.fontWeight, 400, 700);
  return [400, 500, 600, 700].reduce((best, option) =>
    Math.abs(option - parsed) < Math.abs(best - parsed) ? option : best,
  400);
}

function normalizeQueueStrategy(value: unknown): QueueStrategy {
  return value === 'channelOrder' ? 'channelOrder' : 'roundRobin';
}

function normalizeDuplicateImportPolicy(value: unknown): DuplicateImportPolicy {
  return ['ignore', 'replace', 'allow'].includes(String(value)) ? (value as DuplicateImportPolicy) : 'ignore';
}

function normalizeKeywordMatchMode(value: unknown): KeywordMatchMode {
  return value === 'any' ? 'any' : 'all';
}

function normalizeColor(value: unknown, fallback: string): string {
  const text = String(value ?? '').trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

export function normalizeSettings(raw: Record<string, unknown> | null | undefined): AppSettings {
  const source = raw ?? {};
  return {
    ...DEFAULT_APP_SETTINGS,
    ...source,
    theme: normalizeTheme(source.theme),
    density: normalizeDensity(source.density),
    fontPreset: normalizeFontPreset(source.fontPreset),
    customFontFamily: String(source.customFontFamily ?? DEFAULT_APP_SETTINGS.customFontFamily).trim().slice(0, 120),
    fontWeight: normalizeFontWeight(source.fontWeight),
    backgroundImageEnabled:
      typeof source.backgroundImageEnabled === 'boolean'
        ? source.backgroundImageEnabled
        : Boolean(String(source.backgroundImagePath ?? '').trim()) || DEFAULT_APP_SETTINGS.backgroundImageEnabled,
    backgroundImagePath: normalizePathInput(String(source.backgroundImagePath ?? DEFAULT_APP_SETTINGS.backgroundImagePath)),
    backgroundOpacity: boundedNumber(source.backgroundOpacity, DEFAULT_APP_SETTINGS.backgroundOpacity, 0.08, 1),
    backgroundBlur: boundedInteger(source.backgroundBlur, DEFAULT_APP_SETTINGS.backgroundBlur, 0, 30),
    backgroundOverlay: boundedNumber(source.backgroundOverlay, DEFAULT_APP_SETTINGS.backgroundOverlay, 0, 0.9),
    backgroundFit: normalizeBackgroundFit(source.backgroundFit),
    backgroundPosition: normalizeBackgroundPosition(source.backgroundPosition),
    backgroundFocusX: boundedNumber(source.backgroundFocusX, DEFAULT_APP_SETTINGS.backgroundFocusX, 0, 100),
    backgroundFocusY: boundedNumber(source.backgroundFocusY, DEFAULT_APP_SETTINGS.backgroundFocusY, 0, 100),
    backgroundScale: boundedNumber(source.backgroundScale, DEFAULT_APP_SETTINGS.backgroundScale, 1, 2),
    backgroundBrightness: boundedNumber(source.backgroundBrightness, DEFAULT_APP_SETTINGS.backgroundBrightness, 0.35, 1.5),
    backgroundContrast: boundedNumber(source.backgroundContrast, DEFAULT_APP_SETTINGS.backgroundContrast, 0.5, 1.8),
    backgroundSaturation: boundedNumber(source.backgroundSaturation, DEFAULT_APP_SETTINGS.backgroundSaturation, 0, 2),
    backgroundVignette: boundedNumber(source.backgroundVignette, DEFAULT_APP_SETTINGS.backgroundVignette, 0, 0.85),
    backgroundOverlayColor: normalizeColor(source.backgroundOverlayColor, DEFAULT_APP_SETTINGS.backgroundOverlayColor),
    channelTransparencyEnabled:
      typeof source.channelTransparencyEnabled === 'boolean'
        ? source.channelTransparencyEnabled
        : DEFAULT_APP_SETTINGS.channelTransparencyEnabled,
    channelPanelOpacity: boundedNumber(source.channelPanelOpacity, DEFAULT_APP_SETTINGS.channelPanelOpacity, 0.42, 1),
    channelSort: normalizeChannelSort(source.channelSort),
    workspaceWidth: normalizeWorkspaceWidth(source.workspaceWidth),
    defaultDepthMode: normalizeDepthMode(source.defaultDepthMode, DEFAULT_APP_SETTINGS.defaultDepthMode),
    defaultCategory: normalizeCategory(source.defaultCategory, DEFAULT_APP_SETTINGS.defaultCategory),
    defaultDestination: normalizePathInput(String(source.defaultDestination ?? DEFAULT_APP_SETTINGS.defaultDestination)),
    defaultCollisionPolicy: normalizeCollisionPolicy(source.defaultCollisionPolicy),
    defaultFileSort: normalizeFileSort(source.defaultFileSort),
    queueStrategy: normalizeQueueStrategy(source.queueStrategy),
    duplicateImportPolicy: normalizeDuplicateImportPolicy(source.duplicateImportPolicy),
    defaultDepth: boundedInteger(source.defaultDepth, DEFAULT_APP_SETTINGS.defaultDepth, 0, 32),
    logRetention: boundedInteger(source.logRetention, DEFAULT_APP_SETTINGS.logRetention, 100, 10_000),
    maxRecentDestinations: boundedInteger(source.maxRecentDestinations, DEFAULT_APP_SETTINGS.maxRecentDestinations, 3, 30),
    taskHistoryRetention: boundedInteger(source.taskHistoryRetention, DEFAULT_APP_SETTINGS.taskHistoryRetention, 50, 5000),
    extractionHistoryLimit: boundedInteger(source.extractionHistoryLimit, DEFAULT_APP_SETTINGS.extractionHistoryLimit, 3, 200),
    preflightMinimumFreeMb: boundedInteger(source.preflightMinimumFreeMb, DEFAULT_APP_SETTINGS.preflightMinimumFreeMb, 0, 102400),
    preflightSpaceMultiplier: boundedInteger(source.preflightSpaceMultiplier, DEFAULT_APP_SETTINGS.preflightSpaceMultiplier, 1, 10),
    claudeToolsDirectory: normalizePathInput(String(source.claudeToolsDirectory ?? DEFAULT_APP_SETTINGS.claudeToolsDirectory)),
    defaultInboxDirectory: normalizePathInput(String(source.defaultInboxDirectory ?? DEFAULT_APP_SETTINGS.defaultInboxDirectory)),
    defaultInboxMatchMode: normalizeKeywordMatchMode(source.defaultInboxMatchMode),
    keywordScanMaxCandidates: boundedInteger(source.keywordScanMaxCandidates, DEFAULT_APP_SETTINGS.keywordScanMaxCandidates, 1, 500),
    overwriteClaudeDat:
      typeof source.overwriteClaudeDat === 'boolean'
        ? source.overwriteClaudeDat
        : typeof source.overwriteClaudeBat === 'boolean'
          ? source.overwriteClaudeBat
          : DEFAULT_APP_SETTINGS.overwriteClaudeDat,
    openFolderAfterDatInstall:
      typeof source.openFolderAfterDatInstall === 'boolean'
        ? source.openFolderAfterDatInstall
        : typeof source.openFolderAfterBatInstall === 'boolean'
          ? source.openFolderAfterBatInstall
          : DEFAULT_APP_SETTINGS.openFolderAfterDatInstall,
    claudeAutoInstallDat:
      typeof source.claudeAutoInstallDat === 'boolean'
        ? source.claudeAutoInstallDat
        : typeof source.claudeAutoInstallBat === 'boolean'
          ? source.claudeAutoInstallBat
          : DEFAULT_APP_SETTINGS.claudeAutoInstallDat,
  } as AppSettings;
}

export function normalizeChannel(raw: Partial<PersistedChannel>, index: number, settings: AppSettings): Channel {
  const category = normalizeCategory(raw.category, settings.defaultCategory);
  const depthMode = normalizeDepthMode(raw.depthMode, settings.defaultDepthMode);
  const requestedArchiveSubfolder = raw.createArchiveSubfolder ?? settings.defaultCreateArchiveSubfolder;
  const createArchiveSubfolder = depthMode === 'skipOuter' && settings.autoDirectForSkipOuter ? false : requestedArchiveSubfolder;
  return {
    id: raw.id || createId('channel'),
    name: raw.name?.trim() || `通道 ${String(index).padStart(2, '0')}`,
    category,
    categoryColor: raw.categoryColor || categoryDefinition(category).color,
    note: raw.note || '',
    files: [],
    destination: normalizePathInput(raw.destination || settings.defaultDestination),
    useArchiveDirectory: raw.useArchiveDirectory ?? settings.defaultUseArchiveDirectory,
    createArchiveSubfolder,
    deduplicateArchiveRoot: raw.deduplicateArchiveRoot ?? settings.defaultDeduplicateArchiveRoot,
    collisionPolicy: normalizeCollisionPolicy(raw.collisionPolicy ?? settings.defaultCollisionPolicy),
    depthMode,
    depth: boundedInteger(raw.depth, settings.defaultDepth, 0, 32),
    fileSort: normalizeFileSort(raw.fileSort ?? settings.defaultFileSort),
    password: '',
    openAfter: raw.openAfter ?? settings.defaultOpenAfter,
    skipJunkFiles: raw.skipJunkFiles ?? settings.defaultSkipJunkFiles,
    keepEmptyDirectories: raw.keepEmptyDirectories ?? settings.defaultKeepEmptyDirectories,
    inboxDirectory: normalizePathInput(raw.inboxDirectory || settings.defaultInboxDirectory),
    inboxKeywords: String(raw.inboxKeywords || '').trim().slice(0, 500),
    inboxMatchMode: normalizeKeywordMatchMode(raw.inboxMatchMode ?? settings.defaultInboxMatchMode),
    inboxRecursive: raw.inboxRecursive ?? settings.defaultInboxRecursive,
    inboxPreferHighestVersion: raw.inboxPreferHighestVersion ?? settings.defaultPreferHighestVersion,
    inboxIncludePrerelease: raw.inboxIncludePrerelease ?? settings.defaultIncludePrerelease,
    inboxEnabled: raw.inboxEnabled ?? false,
    autoStartEnabled: raw.autoStartEnabled ?? settings.autoStartAfterImport,
    autoLaunchClaudeAfterExtract: raw.autoLaunchClaudeAfterExtract ?? false,
    expanded: raw.expanded ?? settings.autoExpandNewChannel,
    advancedOpen: raw.advancedOpen ?? false,
    dragActive: false,
  };
}

export function defaultChannel(index: number, settings: AppSettings, category = settings.defaultCategory): Channel {
  const definition = categoryDefinition(category);
  return {
    id: createId('channel'),
    name: `通道 ${String(index).padStart(2, '0')}`,
    category,
    categoryColor: definition.color,
    note: '',
    files: [],
    destination: settings.defaultDestination,
    useArchiveDirectory: settings.defaultUseArchiveDirectory,
    createArchiveSubfolder:
      settings.defaultDepthMode === 'skipOuter' && settings.autoDirectForSkipOuter
        ? false
        : settings.defaultCreateArchiveSubfolder,
    deduplicateArchiveRoot: settings.defaultDeduplicateArchiveRoot,
    collisionPolicy: settings.defaultCollisionPolicy,
    depthMode: settings.defaultDepthMode,
    depth: boundedInteger(settings.defaultDepth, DEFAULT_APP_SETTINGS.defaultDepth, 0, 32),
    fileSort: settings.defaultFileSort,
    password: '',
    openAfter: settings.defaultOpenAfter,
    skipJunkFiles: settings.defaultSkipJunkFiles,
    keepEmptyDirectories: settings.defaultKeepEmptyDirectories,
    inboxDirectory: settings.defaultInboxDirectory,
    inboxKeywords: '',
    inboxMatchMode: settings.defaultInboxMatchMode,
    inboxRecursive: settings.defaultInboxRecursive,
    inboxPreferHighestVersion: settings.defaultPreferHighestVersion,
    inboxIncludePrerelease: settings.defaultIncludePrerelease,
    inboxEnabled: false,
    autoStartEnabled: settings.autoStartAfterImport,
    autoLaunchClaudeAfterExtract: false,
    expanded: settings.autoExpandNewChannel,
    advancedOpen: false,
    dragActive: false,
  };
}

interface StorageEntry<T> {
  key: string;
  value: T;
}

function parseStorageEntry<T>(keys: string[]): StorageEntry<T> | null {
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      return { key, value: JSON.parse(raw) as T };
    } catch {
      // Try the next compatible storage version.
    }
  }
  return null;
}

export function parseStorage<T>(keys: string[]): T | null {
  return parseStorageEntry<T>(keys)?.value ?? null;
}

export function loadPersisted(): PersistedState | null {
  const entry = parseStorageEntry<Record<string, unknown>>([STORAGE_KEY, ...LEGACY_STORAGE_KEYS]);
  if (!entry) return null;
  const parsed = entry.value;
  const legacyLayoutMigration = ![STORAGE_KEY, 'multichannel-extractor-state-v9', 'multichannel-extractor-state-v8', 'multichannel-extractor-state-v7'].includes(entry.key);
  const rawSettings =
    (parsed.appSettings as Record<string, unknown> | undefined) ?? (parsed.theme ? { theme: parsed.theme } : undefined);
  const settings = normalizeSettings(legacyLayoutMigration
    ? {
        ...rawSettings,
        defaultCreateArchiveSubfolder: false,
        defaultCollisionPolicy: 'overwrite',
        confirmBeforeOverwrite: false,
        autoDirectForSkipOuter: true,
        defaultDeduplicateArchiveRoot: true,
      }
    : rawSettings);
  const channels = Array.isArray(parsed.channels)
    ? parsed.channels.map((channel, index) => {
        const source = channel as Partial<PersistedChannel>;
        return normalizeChannel(
          legacyLayoutMigration
            ? { ...source, createArchiveSubfolder: false, collisionPolicy: 'overwrite', deduplicateArchiveRoot: true }
            : source,
          index + 1,
          settings,
        );
      })
    : [];
  const maxRecent = settings.maxRecentDestinations;
  const recentDestinations = Array.isArray(parsed.recentDestinations)
    ? parsed.recentDestinations.map(String).map(normalizePathInput).filter(Boolean).slice(0, maxRecent)
    : [];
  return {
    channels: channels.map(toPersistedChannel),
    maxConcurrency: boundedInteger(parsed.maxConcurrency, 3, 1, 8),
    appSettings: settings,
    recentDestinations,
  };
}

export function normalizePreset(raw: Partial<ChannelPreset>): ChannelPreset | null {
  if (!raw.name?.trim()) return null;
  const category = normalizeCategory(raw.category);
  return {
    name: raw.name.trim(),
    destination: normalizePathInput(raw.destination || ''),
    useArchiveDirectory: raw.useArchiveDirectory ?? true,
    createArchiveSubfolder: raw.createArchiveSubfolder ?? false,
    deduplicateArchiveRoot: raw.deduplicateArchiveRoot ?? true,
    collisionPolicy: normalizeCollisionPolicy(raw.collisionPolicy ?? 'overwrite'),
    depthMode: normalizeDepthMode(raw.depthMode),
    depth: boundedInteger(raw.depth, 2, 0, 32),
    openAfter: raw.openAfter ?? false,
    fileSort: normalizeFileSort(raw.fileSort),
    skipJunkFiles: raw.skipJunkFiles ?? true,
    keepEmptyDirectories: raw.keepEmptyDirectories ?? true,
    category,
    categoryColor: raw.categoryColor || categoryDefinition(category).color,
    note: raw.note || '',
    inboxDirectory: normalizePathInput(raw.inboxDirectory || ''),
    inboxKeywords: String(raw.inboxKeywords || '').trim().slice(0, 500),
    inboxMatchMode: normalizeKeywordMatchMode(raw.inboxMatchMode),
    inboxRecursive: raw.inboxRecursive ?? false,
    inboxPreferHighestVersion: raw.inboxPreferHighestVersion ?? true,
    inboxIncludePrerelease: raw.inboxIncludePrerelease ?? false,
    inboxEnabled: raw.inboxEnabled ?? false,
    autoStartEnabled: raw.autoStartEnabled ?? false,
    autoLaunchClaudeAfterExtract: raw.autoLaunchClaudeAfterExtract ?? false,
  };
}

export function loadPresets(): ChannelPreset[] {
  const entry = parseStorageEntry<Partial<ChannelPreset>[]>([PRESET_KEY, ...LEGACY_PRESET_KEYS]);
  if (!entry || !Array.isArray(entry.value)) return [];
  const legacyLayoutMigration = ![PRESET_KEY, 'multichannel-extractor-presets-v9', 'multichannel-extractor-presets-v8', 'multichannel-extractor-presets-v7'].includes(entry.key);
  return entry.value
    .map((preset) => normalizePreset(legacyLayoutMigration
      ? { ...preset, createArchiveSubfolder: false, collisionPolicy: 'overwrite', deduplicateArchiveRoot: true }
      : preset))
    .filter((item): item is ChannelPreset => Boolean(item));
}

export function toPersistedChannel(channel: Channel): PersistedChannel {
  return {
    id: channel.id,
    name: channel.name,
    category: channel.category,
    categoryColor: channel.categoryColor,
    note: channel.note,
    destination: channel.destination,
    useArchiveDirectory: channel.useArchiveDirectory,
    createArchiveSubfolder: channel.createArchiveSubfolder,
    deduplicateArchiveRoot: channel.deduplicateArchiveRoot,
    collisionPolicy: channel.collisionPolicy,
    depthMode: channel.depthMode,
    depth: channel.depth,
    fileSort: channel.fileSort,
    openAfter: channel.openAfter,
    skipJunkFiles: channel.skipJunkFiles,
    keepEmptyDirectories: channel.keepEmptyDirectories,
    inboxDirectory: channel.inboxDirectory,
    inboxKeywords: channel.inboxKeywords,
    inboxMatchMode: channel.inboxMatchMode,
    inboxRecursive: channel.inboxRecursive,
    inboxPreferHighestVersion: channel.inboxPreferHighestVersion,
    inboxIncludePrerelease: channel.inboxIncludePrerelease,
    inboxEnabled: channel.inboxEnabled,
    autoStartEnabled: channel.autoStartEnabled,
    autoLaunchClaudeAfterExtract: channel.autoLaunchClaudeAfterExtract,
    expanded: channel.expanded,
    advancedOpen: channel.advancedOpen,
  };
}

export function normalizeConfigurationBundle(raw: unknown): ConfigurationBundle {
  if (!raw || typeof raw !== 'object') throw new Error('配置文件内容无效');
  const source = raw as Record<string, unknown>;
  const legacyLayoutMigration = Number(source.schemaVersion || 0) < 5;
  const rawSettings = source.appSettings as Record<string, unknown> | undefined;
  const settings = normalizeSettings(legacyLayoutMigration
    ? {
        ...rawSettings,
        defaultCreateArchiveSubfolder: false,
        defaultCollisionPolicy: 'overwrite',
        confirmBeforeOverwrite: false,
        autoDirectForSkipOuter: true,
        defaultDeduplicateArchiveRoot: true,
      }
    : rawSettings);
  const channels = Array.isArray(source.channels)
    ? source.channels.map((item, index) => {
        const channel = item as Partial<PersistedChannel>;
        return toPersistedChannel(normalizeChannel(legacyLayoutMigration
          ? { ...channel, createArchiveSubfolder: false, collisionPolicy: 'overwrite', deduplicateArchiveRoot: true }
          : channel, index + 1, settings));
      })
    : [];
  const presets = Array.isArray(source.presets)
    ? source.presets
        .map((item) => {
          const preset = item as Partial<ChannelPreset>;
          return normalizePreset(legacyLayoutMigration
            ? { ...preset, createArchiveSubfolder: false, collisionPolicy: 'overwrite', deduplicateArchiveRoot: true }
            : preset);
        })
        .filter((item): item is ChannelPreset => Boolean(item))
    : [];
  const recentDestinations = Array.isArray(source.recentDestinations)
    ? source.recentDestinations.map(String).map(normalizePathInput).filter(Boolean).slice(0, settings.maxRecentDestinations)
    : [];
  return {
    schemaVersion: 10,
    exportedAt: String(source.exportedAt || new Date().toISOString()),
    maxConcurrency: boundedInteger(source.maxConcurrency, 3, 1, 8),
    appSettings: settings,
    channels,
    presets,
    recentDestinations,
  };
}
