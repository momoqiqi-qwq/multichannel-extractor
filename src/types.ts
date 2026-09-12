export type FileStatus = 'pending' | 'queued' | 'processing' | 'paused' | 'success' | 'error' | 'cancelled';
export type ChannelStatus = 'idle' | 'queued' | 'processing' | 'paused' | 'done' | 'error';
export type FilePriority = 'high' | 'normal' | 'low';
export type DepthModeType = 'preserve' | 'flatten' | 'skipOuter';
export type DensityMode = 'compact' | 'comfortable' | 'spacious';
export type WorkspaceWidthMode = 'fluid' | 'wide' | 'focused';
export type ChannelAutomationProfile = 'manual' | 'import-auto' | 'latest-manual' | 'latest-auto';
export type FontPresetId =
  | 'system'
  | 'microsoft-yahei'
  | 'segoe-ui'
  | 'noto-sans-cjk'
  | 'serif'
  | 'monospace'
  | 'custom';
export type BackgroundFitMode = 'cover' | 'contain' | 'stretch';
export type BackgroundPositionMode = 'center' | 'top' | 'bottom' | 'left' | 'right';
export type ChannelSortMode = 'manual' | 'name' | 'category' | 'status';
export type FileSortMode = 'manual' | 'name' | 'size' | 'status';
export type QueueStrategy = 'channelOrder' | 'roundRobin';
export type DuplicateImportPolicy = 'ignore' | 'replace' | 'allow';
export type KeywordMatchMode = 'all' | 'any';
export type CollisionPolicy = 'rename' | 'overwrite' | 'skip';
export type ThemeId =
  | 'classic-dark'
  | 'claude-light'
  | 'claude-dark'
  | 'midnight-blue'
  | 'graphite-black'
  | 'glass-blue'
  | 'paper-cream'
  | 'amethyst'
  | 'win11'
  | 'sunset'
  | 'mint-light';
export type ChannelCategory =
  | 'general'
  | 'work'
  | 'media'
  | 'delivery'
  | 'backup'
  | 'download'
  | 'encrypted'
  | 'temporary';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  dark: boolean;
  swatches: [string, string, string];
}

export interface ChannelCategoryDefinition {
  id: ChannelCategory;
  name: string;
  description: string;
  color: string;
}

export interface AppSettings {
  theme: ThemeId;
  density: DensityMode;
  fontPreset: FontPresetId;
  customFontFamily: string;
  fontWeight: number;
  backgroundImageEnabled: boolean;
  backgroundImagePath: string;
  backgroundOpacity: number;
  backgroundBlur: number;
  backgroundOverlay: number;
  backgroundFit: BackgroundFitMode;
  backgroundPosition: BackgroundPositionMode;
  backgroundFocusX: number;
  backgroundFocusY: number;
  backgroundScale: number;
  backgroundBrightness: number;
  backgroundContrast: number;
  backgroundSaturation: number;
  backgroundVignette: number;
  backgroundOverlayColor: string;
  channelTransparencyEnabled: boolean;
  channelPanelOpacity: number;
  reduceMotion: boolean;
  glassEffects: boolean;
  confirmBeforeDelete: boolean;
  autoExpandNewChannel: boolean;
  autoExpandOnError: boolean;
  autoStartAfterImport: boolean;
  autoClearCompleted: boolean;
  hideCompletedFiles: boolean;
  showUnsupportedFiles: boolean;
  showPathHints: boolean;
  showLayoutExamples: boolean;
  hideDescriptions: boolean;
  showDetailedExplanations: boolean;
  defaultUseArchiveDirectory: boolean;
  defaultDestination: string;
  defaultCreateArchiveSubfolder: boolean;
  defaultDeduplicateArchiveRoot: boolean;
  defaultCollisionPolicy: CollisionPolicy;
  defaultOpenAfter: boolean;
  defaultDepthMode: DepthModeType;
  defaultDepth: number;
  defaultCategory: ChannelCategory;
  channelSort: ChannelSortMode;
  groupByCategory: boolean;
  logRetention: number;
  queueStrategy: QueueStrategy;
  duplicateImportPolicy: DuplicateImportPolicy;
  confirmBeforeOverwrite: boolean;
  autoDirectForSkipOuter: boolean;
  autoCollapseSuccessful: boolean;
  successToasts: boolean;
  errorToasts: boolean;
  compactTopbar: boolean;
  stickyToolbar: boolean;
  showChannelNumbers: boolean;
  showFileSize: boolean;
  showFileFormat: boolean;
  defaultFileSort: FileSortMode;
  defaultSkipJunkFiles: boolean;
  defaultKeepEmptyDirectories: boolean;
  maxRecentDestinations: number;
  taskHistoryRetention: number;
  extractionHistoryLimit: number;
  autoOpenTaskCenterOnFailure: boolean;
  confirmBeforeDeleteOutput: boolean;
  deleteReplacedOutputs: boolean;
  claudeToolsDirectory: string;
  overwriteClaudeDat: boolean;
  confirmBeforeClaudeBypass: boolean;
  openFolderAfterDatInstall: boolean;
  preflightEnabled: boolean;
  preflightCheckPassword: boolean;
  preflightCheckDiskSpace: boolean;
  preflightCheckConflicts: boolean;
  preflightMinimumFreeMb: number;
  preflightSpaceMultiplier: number;
  showOutputPreviewBeforeStart: boolean;
  autoResumeInterrupted: boolean;
  showRecoveryBanner: boolean;
  enablePauseResume: boolean;
  showEta: boolean;
  enableFilePriority: boolean;
  settingsSidebarCompact: boolean;
  confirmBeforeResumeInterrupted: boolean;
  defaultInboxDirectory: string;
  defaultInboxMatchMode: KeywordMatchMode;
  defaultInboxRecursive: boolean;
  defaultPreferHighestVersion: boolean;
  defaultIncludePrerelease: boolean;
  keywordScanMaxCandidates: number;
  autoScanKeywordChannelsOnLaunch: boolean;
  keywordScanReplaceQueue: boolean;
  keywordScanAutoAdd: boolean;
  autoLearnChannelKeywords: boolean;
  autoRouteDroppedFiles: boolean;
  claudeAutoInstallDat: boolean;
  claudeVerifyBeforeLaunch: boolean;
  showTopbarConcurrency: boolean;
  showQuickSettings: boolean;
  showProjectCenterShortcut: boolean;
  showTaskCenterShortcut: boolean;
  showLogsShortcut: boolean;
  showWorkspaceSearch: boolean;
  showWorkspaceFilters: boolean;
  showShortcutHints: boolean;
  scanLatestOnEmptyStart: boolean;
  showExpandCollapseControl: boolean;
  showGlobalStartControl: boolean;
  showInboxScanControl: boolean;
  showWorkspaceCleanupControls: boolean;
  showAddChannelControl: boolean;
  showChannelOrderControls: boolean;
  showChannelDuplicateControl: boolean;
  showChannelDeleteControl: boolean;
  workspaceWidth: WorkspaceWidthMode;
  showBrandSubtitle: boolean;
  showColumnHeaders: boolean;
  showToolbarSummary: boolean;
  showStatusBar: boolean;
  showCommandPaletteShortcut: boolean;
  showRecentActionsShortcut: boolean;
  showExtractionHistoryShortcut: boolean;
  showUndoShortcut: boolean;
  showChannelAutomationControls: boolean;
}

export interface ArchiveFile {
  id: string;
  path: string;
  name: string;
  size: number;
  format: string;
  supported: boolean;
  status: FileStatus;
  progress: number;
  message?: string;
  outputPath?: string;
  manifestPath?: string;
  writtenFiles?: number;
  replacedFiles?: number;
  outputDeleted?: boolean;
  priority: FilePriority;
}

export interface ChannelPreset {
  name: string;
  destination: string;
  useArchiveDirectory: boolean;
  createArchiveSubfolder: boolean;
  deduplicateArchiveRoot: boolean;
  collisionPolicy: CollisionPolicy;
  depthMode: DepthModeType;
  depth: number;
  openAfter: boolean;
  fileSort: FileSortMode;
  skipJunkFiles: boolean;
  keepEmptyDirectories: boolean;
  category: ChannelCategory;
  categoryColor: string;
  note: string;
  inboxDirectory: string;
  inboxKeywords: string;
  inboxMatchMode: KeywordMatchMode;
  inboxRecursive: boolean;
  inboxPreferHighestVersion: boolean;
  inboxIncludePrerelease: boolean;
  inboxEnabled: boolean;
  autoStartEnabled: boolean;
  autoLaunchClaudeAfterExtract: boolean;
}

export interface Channel {
  id: string;
  name: string;
  category: ChannelCategory;
  categoryColor: string;
  note: string;
  files: ArchiveFile[];
  destination: string;
  useArchiveDirectory: boolean;
  createArchiveSubfolder: boolean;
  deduplicateArchiveRoot: boolean;
  collisionPolicy: CollisionPolicy;
  depthMode: DepthModeType;
  depth: number;
  fileSort: FileSortMode;
  password: string;
  openAfter: boolean;
  skipJunkFiles: boolean;
  keepEmptyDirectories: boolean;
  inboxDirectory: string;
  inboxKeywords: string;
  inboxMatchMode: KeywordMatchMode;
  inboxRecursive: boolean;
  inboxPreferHighestVersion: boolean;
  inboxIncludePrerelease: boolean;
  inboxEnabled: boolean;
  autoStartEnabled: boolean;
  autoLaunchClaudeAfterExtract: boolean;
  expanded: boolean;
  advancedOpen: boolean;
  dragActive: boolean;
  /** 该通道的关键词扫描历史（最近 N 条），用于历史抽屉与重新加入队列。 */
  scanHistory: ScanHistoryEntry[];
}


export interface ArchiveDirectoryScanRequest {
  directory: string;
  keywords: string[];
  matchMode: KeywordMatchMode;
  recursive: boolean;
  preferHighestVersion: boolean;
  includePrerelease: boolean;
  maxCandidates: number;
}

export interface ArchiveDirectoryCandidate {
  path: string;
  name: string;
  size: number;
  format: string;
  versionLabel?: string;
  versionParts: number[];
  modifiedUnix: number;
  matchedKeywords: string[];
  prerelease: boolean;
}

export interface ArchiveDirectoryScanResult {
  directory: string;
  keywords: string[];
  candidates: ArchiveDirectoryCandidate[];
  selectedPath?: string;
  selectedName?: string;
  selectionReason: string;
  scannedFiles: number;
  matchedFiles: number;
}

/** 一次关键词扫描的历史记录（按通道保存，可重新加入队列）。 */
export interface ScanHistoryEntry {
  id: string;
  scannedAt: string;
  directory: string;
  keywords: string[];
  scannedFiles: number;
  matchedFiles: number;
  selectedName?: string;
  selectedPath?: string;
  selectionReason: string;
  candidates: ArchiveDirectoryCandidate[];
}

export type ProjectStatus = 'active' | 'paused' | 'archived';

export interface ProjectRecord {
  id: string;
  name: string;
  path: string;
  status: ProjectStatus;
  pinned: boolean;
  note: string;
  tags: string[];
  sourceChannelId?: string;
  sourceChannelName?: string;
  sourceFileName?: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
  lastExtractedAt?: string;
}

export interface ClaudeCliStatus {
  available: boolean;
  executable?: string;
  version?: string;
  source?: string;
  message: string;
}

export interface ClaudeLaunchResult {
  workingDirectory: string;
  datPath: string;
  command: string;
  launcher: string;
  processId: number;
}

export interface InspectedFile {
  path: string;
  name: string;
  size: number;
  format: string;
  supported: boolean;
}

export type DepthModePayload =
  | { type: 'preserve' }
  | { type: 'flatten'; depth: number }
  | { type: 'skipOuter' };

export interface ExtractionJobPayload {
  jobId: string;
  channelId: string;
  archivePath: string;
  destination: string;
  useArchiveDirectory: boolean;
  createArchiveSubfolder: boolean;
  deduplicateArchiveRoot: boolean;
  collisionPolicy: CollisionPolicy;
  depthMode: DepthModePayload;
  password?: string;
  openAfter: boolean;
  skipJunkFiles: boolean;
  keepEmptyDirectories: boolean;
}

export interface StartBatchPayload {
  jobs: ExtractionJobPayload[];
  maxConcurrency: number;
}

export interface ProgressEvent {
  jobId: string;
  channelId: string;
  archivePath: string;
  progress: number;
  phase: 'queued' | 'extracting' | 'arranging' | 'paused' | 'finished';
  message: string;
}

export interface JobFinishedEvent {
  jobId: string;
  channelId: string;
  archivePath: string;
  success: boolean;
  outputPath?: string;
  error?: string;
  durationMs: number;
  manifestPath?: string;
  writtenFiles: number;
  replacedFiles: number;
}

export interface BatchFinishedEvent {
  batchId: string;
  total: number;
  succeeded: number;
  failed: number;
  cancelled: number;
}



export type TaskRecordStatus = 'queued' | 'processing' | 'paused' | 'success' | 'error' | 'cancelled' | 'interrupted' | 'recovered' | 'deleted';

export interface TaskRecord {
  id: string;
  jobId: string;
  batchId?: string;
  channelId: string;
  channelName: string;
  archivePath: string;
  fileName: string;
  status: TaskRecordStatus;
  progress: number;
  phase?: ProgressEvent['phase'];
  message: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  outputPath?: string;
  manifestPath?: string;
  writtenFiles: number;
  replacedFiles: number;
  outputDeleted?: boolean;
  etaSeconds?: number;
  pausedAt?: string;
  pausedDurationMs?: number;
  jobSnapshot?: Omit<ExtractionJobPayload, 'password'>;
  requiresPassword?: boolean;
}

export type PreflightSeverity = 'info' | 'warning' | 'error';

export interface PreflightIssue {
  code: string;
  severity: PreflightSeverity;
  message: string;
}

export interface PreflightJobResult {
  jobId: string;
  channelId: string;
  archivePath: string;
  outputPath?: string;
  archiveSize: number;
  estimatedRequiredBytes: number;
  availableBytes?: number;
  issues: PreflightIssue[];
}

export interface PreflightRequest {
  jobs: ExtractionJobPayload[];
  checkPassword: boolean;
  checkDiskSpace: boolean;
  checkConflicts: boolean;
  minimumFreeBytes: number;
  spaceMultiplier: number;
}

export interface PreflightResult {
  jobs: PreflightJobResult[];
  blockingIssueCount: number;
  warningCount: number;
}

export interface StartReviewState {
  title: string;
  jobs: ExtractionJobPayload[];
  preflight: PreflightResult;
  localIssues: PreflightIssue[];
}

export interface DeleteExtractionResult {
  deletedFiles: number;
  skippedReplacedFiles: number;
  deletedDirectories: number;
}

export interface ConfigurationBundle {
  schemaVersion: 10;
  exportedAt: string;
  maxConcurrency: number;
  appSettings: AppSettings;
  channels: Array<Omit<Channel, 'files' | 'dragActive' | 'password'>>;
  presets: ChannelPreset[];
  recentDestinations: string[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  channelName?: string;
  fileName?: string;
  message: string;
}

export interface ToastMessage {
  id: string;
  level: 'info' | 'success' | 'warn' | 'error';
  title: string;
  message?: string;
  timeoutMs?: number;
}
