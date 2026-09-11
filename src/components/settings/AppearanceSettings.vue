<script setup lang="ts">
import { computed } from 'vue';
import { DEFAULT_APP_SETTINGS, FONT_DEFINITIONS, THEME_DEFINITIONS } from '../../config/appearance';
import { APP_RELEASE_NAME } from '../../config/version';
import { clearBackgroundImage, installBackgroundImage, pickBackgroundImage } from '../../services/tauri';
import { useChannelStore } from '../../stores/channels';

const store = useChannelStore();
function moveBackgroundFocus(event: PointerEvent): void {
  const target = event.currentTarget as HTMLElement;
  if (event.type === 'pointerdown') target.setPointerCapture?.(event.pointerId);
  const rect = target.getBoundingClientRect();
  store.appSettings.backgroundFocusX = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
  store.appSettings.backgroundFocusY = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
  store.appSettings.backgroundPosition = 'center';
}

const selectedFont = computed(() => FONT_DEFINITIONS.find((item) => item.id === store.appSettings.fontPreset));

async function chooseBackgroundImage(): Promise<void> {
  try {
    const path = await pickBackgroundImage(store.appSettings.backgroundImagePath);
    if (!path) return;
    const installedPath = await installBackgroundImage(path);
    store.appSettings.backgroundImagePath = installedPath;
    store.appSettings.backgroundImageEnabled = true;
    store.pushToast({ level: 'success', title: '背景图片已更新', message: installedPath });
  } catch (error) {
    store.pushToast({ level: 'error', title: '无法选择背景图片', message: String(error) });
  }
}

async function removeBackgroundImage(): Promise<void> {
  try {
    await clearBackgroundImage();
  } catch (error) {
    store.pushToast({ level: 'warn', title: '背景文件清理失败', message: String(error) });
  }
  store.appSettings.backgroundImagePath = '';
  store.appSettings.backgroundImageEnabled = false;
}

function resetBackgroundFocus(): void {
  store.appSettings.backgroundFocusX = 50;
  store.appSettings.backgroundFocusY = 50;
  store.appSettings.backgroundPosition = 'center';
}

function applyBackgroundPreset(preset: 'clear' | 'readable' | 'soft' | 'vivid'): void {
  if (!store.appSettings.backgroundImagePath) {
    store.pushToast({ level: 'info', title: '请先选择背景图片', message: '选择图片后再应用快速效果。' });
    return;
  }
  const presets = {
    clear: { backgroundOpacity: 1, backgroundOverlay: 0.08, backgroundBlur: 0, backgroundBrightness: 1, backgroundContrast: 1, backgroundSaturation: 1, backgroundVignette: 0.08, channelPanelOpacity: 0.72 },
    readable: { backgroundOpacity: 0.72, backgroundOverlay: 0.4, backgroundBlur: 2, backgroundBrightness: 0.82, backgroundContrast: 1.05, backgroundSaturation: 0.9, backgroundVignette: 0.28, channelPanelOpacity: 0.82 },
    soft: { backgroundOpacity: 0.62, backgroundOverlay: 0.3, backgroundBlur: 8, backgroundBrightness: 0.92, backgroundContrast: 0.92, backgroundSaturation: 0.78, backgroundVignette: 0.2, channelPanelOpacity: 0.76 },
    vivid: { backgroundOpacity: 0.9, backgroundOverlay: 0.18, backgroundBlur: 0, backgroundBrightness: 1.08, backgroundContrast: 1.12, backgroundSaturation: 1.3, backgroundVignette: 0.18, channelPanelOpacity: 0.7 },
  } as const;
  Object.assign(store.appSettings, presets[preset]);
  store.appSettings.backgroundImageEnabled = true;
}

function applyWorkspaceVisibilityPreset(mode: 'all' | 'focused'): void {
  const visible = mode === 'all';
  Object.assign(store.appSettings, {
    showTopbarConcurrency: visible,
    showQuickSettings: true,
    showProjectCenterShortcut: visible,
    showTaskCenterShortcut: visible,
    showLogsShortcut: visible,
    showWorkspaceSearch: true,
    showWorkspaceFilters: true,
    showShortcutHints: visible,
    showExpandCollapseControl: visible,
    showGlobalStartControl: true,
    showInboxScanControl: visible,
    showWorkspaceCleanupControls: visible,
    showAddChannelControl: true,
    showChannelOrderControls: visible,
    showChannelDuplicateControl: visible,
    showChannelDeleteControl: true,
    showCommandPaletteShortcut: true,
    showRecentActionsShortcut: visible,
    showExtractionHistoryShortcut: visible,
    showUndoShortcut: visible,
    showChannelAutomationControls: true,
    showBrandSubtitle: visible,
    showColumnHeaders: visible,
    showToolbarSummary: true,
    showStatusBar: true,
  });
  store.pushToast({
    level: 'info',
    title: mode === 'all' ? '工作区开关已全部打开' : '已应用精简开关方案',
    message: mode === 'all' ? '顶部、工具栏和通道快捷操作已恢复完整显示。' : '保留开始、新建、删除、搜索和筛选，其余快捷入口精简隐藏。',
  });
}

function resetAppearance(): void {
  Object.assign(store.appSettings, {
    theme: DEFAULT_APP_SETTINGS.theme,
    density: DEFAULT_APP_SETTINGS.density,
    fontPreset: DEFAULT_APP_SETTINGS.fontPreset,
    customFontFamily: DEFAULT_APP_SETTINGS.customFontFamily,
    fontWeight: DEFAULT_APP_SETTINGS.fontWeight,
    backgroundImageEnabled: DEFAULT_APP_SETTINGS.backgroundImageEnabled,
    backgroundImagePath: DEFAULT_APP_SETTINGS.backgroundImagePath,
    backgroundOpacity: DEFAULT_APP_SETTINGS.backgroundOpacity,
    backgroundBlur: DEFAULT_APP_SETTINGS.backgroundBlur,
    backgroundOverlay: DEFAULT_APP_SETTINGS.backgroundOverlay,
    backgroundFit: DEFAULT_APP_SETTINGS.backgroundFit,
    backgroundPosition: DEFAULT_APP_SETTINGS.backgroundPosition,
    backgroundFocusX: DEFAULT_APP_SETTINGS.backgroundFocusX,
    backgroundFocusY: DEFAULT_APP_SETTINGS.backgroundFocusY,
    backgroundScale: DEFAULT_APP_SETTINGS.backgroundScale,
    backgroundBrightness: DEFAULT_APP_SETTINGS.backgroundBrightness,
    backgroundContrast: DEFAULT_APP_SETTINGS.backgroundContrast,
    backgroundSaturation: DEFAULT_APP_SETTINGS.backgroundSaturation,
    backgroundVignette: DEFAULT_APP_SETTINGS.backgroundVignette,
    backgroundOverlayColor: DEFAULT_APP_SETTINGS.backgroundOverlayColor,
    channelTransparencyEnabled: DEFAULT_APP_SETTINGS.channelTransparencyEnabled,
    channelPanelOpacity: DEFAULT_APP_SETTINGS.channelPanelOpacity,
    reduceMotion: DEFAULT_APP_SETTINGS.reduceMotion,
    glassEffects: DEFAULT_APP_SETTINGS.glassEffects,
    hideCompletedFiles: DEFAULT_APP_SETTINGS.hideCompletedFiles,
    showUnsupportedFiles: DEFAULT_APP_SETTINGS.showUnsupportedFiles,
    showPathHints: DEFAULT_APP_SETTINGS.showPathHints,
    showLayoutExamples: DEFAULT_APP_SETTINGS.showLayoutExamples,
    groupByCategory: DEFAULT_APP_SETTINGS.groupByCategory,
    compactTopbar: DEFAULT_APP_SETTINGS.compactTopbar,
    stickyToolbar: DEFAULT_APP_SETTINGS.stickyToolbar,
    showChannelNumbers: DEFAULT_APP_SETTINGS.showChannelNumbers,
    showFileSize: DEFAULT_APP_SETTINGS.showFileSize,
    showFileFormat: DEFAULT_APP_SETTINGS.showFileFormat,
    showTopbarConcurrency: DEFAULT_APP_SETTINGS.showTopbarConcurrency,
    showQuickSettings: DEFAULT_APP_SETTINGS.showQuickSettings,
    showProjectCenterShortcut: DEFAULT_APP_SETTINGS.showProjectCenterShortcut,
    showTaskCenterShortcut: DEFAULT_APP_SETTINGS.showTaskCenterShortcut,
    showLogsShortcut: DEFAULT_APP_SETTINGS.showLogsShortcut,
    showWorkspaceSearch: DEFAULT_APP_SETTINGS.showWorkspaceSearch,
    showWorkspaceFilters: DEFAULT_APP_SETTINGS.showWorkspaceFilters,
    showShortcutHints: DEFAULT_APP_SETTINGS.showShortcutHints,
    showExpandCollapseControl: DEFAULT_APP_SETTINGS.showExpandCollapseControl,
    showGlobalStartControl: DEFAULT_APP_SETTINGS.showGlobalStartControl,
    showInboxScanControl: DEFAULT_APP_SETTINGS.showInboxScanControl,
    showWorkspaceCleanupControls: DEFAULT_APP_SETTINGS.showWorkspaceCleanupControls,
    showAddChannelControl: DEFAULT_APP_SETTINGS.showAddChannelControl,
    showChannelOrderControls: DEFAULT_APP_SETTINGS.showChannelOrderControls,
    showChannelDuplicateControl: DEFAULT_APP_SETTINGS.showChannelDuplicateControl,
    showChannelDeleteControl: DEFAULT_APP_SETTINGS.showChannelDeleteControl,
    workspaceWidth: DEFAULT_APP_SETTINGS.workspaceWidth,
    showBrandSubtitle: DEFAULT_APP_SETTINGS.showBrandSubtitle,
    showColumnHeaders: DEFAULT_APP_SETTINGS.showColumnHeaders,
    showToolbarSummary: DEFAULT_APP_SETTINGS.showToolbarSummary,
    showStatusBar: DEFAULT_APP_SETTINGS.showStatusBar,
    showCommandPaletteShortcut: DEFAULT_APP_SETTINGS.showCommandPaletteShortcut,
    showRecentActionsShortcut: DEFAULT_APP_SETTINGS.showRecentActionsShortcut,
    showExtractionHistoryShortcut: DEFAULT_APP_SETTINGS.showExtractionHistoryShortcut,
    showUndoShortcut: DEFAULT_APP_SETTINGS.showUndoShortcut,
    showChannelAutomationControls: DEFAULT_APP_SETTINGS.showChannelAutomationControls,
  });
  store.pushToast({ level: 'info', title: '外观设置已恢复默认' });
}
</script>

<template>
  <section class="settings-section">
    <div class="settings-section-head">
      <div>
        <h3>主题</h3>
        <p>主题只改变显示，不影响任务与通道配置。所有外观设置会自动保存。</p>
      </div>
      <button class="btn btn-ghost btn-sm" type="button" @click="resetAppearance">恢复默认外观</button>
    </div>
    <div class="theme-grid">
      <button
        v-for="theme in THEME_DEFINITIONS"
        :key="theme.id"
        class="theme-card"
        :class="{ active: store.appSettings.theme === theme.id }"
        type="button"
        @click="store.appSettings.theme = theme.id"
      >
        <span class="theme-swatches" aria-hidden="true">
          <i v-for="color in theme.swatches" :key="color" :style="{ background: color }" />
        </span>
        <span class="theme-copy">
          <b>{{ theme.name }}</b>
          <small>{{ theme.description }}</small>
        </span>
        <span v-if="store.appSettings.theme === theme.id" class="theme-check">✓</span>
      </button>
    </div>
  </section>

  <section class="settings-section settings-two-column appearance-customization">
    <div class="settings-panel">
      <h3>显示字体</h3>
      <label class="settings-field">
        <span>字体方案</span>
        <select v-model="store.appSettings.fontPreset" class="option-input">
          <option v-for="font in FONT_DEFINITIONS" :key="font.id" :value="font.id">{{ font.name }}</option>
        </select>
      </label>
      <label v-if="store.appSettings.fontPreset === 'custom'" class="settings-field">
        <span>字体名称</span>
        <input
          v-model.trim="store.appSettings.customFontFamily"
          class="option-input"
          maxlength="120"
          placeholder="例如：霞鹜文楷"
        />
      </label>
      <label class="settings-field">
        <span>字重</span>
        <select v-model.number="store.appSettings.fontWeight" class="option-input">
          <option :value="400">常规 400</option>
          <option :value="500">中等 500</option>
          <option :value="600">半粗 600</option>
          <option :value="700">粗体 700</option>
        </select>
      </label>
      <div class="setting-note">
        <b>{{ selectedFont?.name }}</b>
        <span>{{ selectedFont?.description }}</span>
        <small>自定义字体需要已安装在当前系统中，不会把字体文件打包进应用。</small>
      </div>
    </div>

    <div class="settings-panel background-settings-panel">
      <h3>自定义背景</h3>
      <label class="switch-row background-master-switch">
        <span><b>显示背景图片</b><small>可随时关闭，不会删除已经选择的图片</small></span>
        <input v-model="store.appSettings.backgroundImageEnabled" type="checkbox" :disabled="!store.appSettings.backgroundImagePath" />
      </label>
      <div class="background-path-row">
        <input
          v-model="store.appSettings.backgroundImagePath"
          class="path-input"
          placeholder="未设置背景图片"
          aria-label="背景图片路径"
          readonly
        />
        <button class="btn btn-sm" type="button" @click="chooseBackgroundImage">选择图片</button>
        <button
          class="btn btn-ghost btn-sm"
          type="button"
          :disabled="!store.appSettings.backgroundImagePath"
          @click="removeBackgroundImage"
        >清除</button>
      </div>
      <div class="setting-note compact-note">
        <span>选中的图片会复制到应用数据目录；原图移动或删除后，背景仍可正常使用。</span>
        <small>支持 PNG、JPG、WEBP、BMP、GIF，单张不超过 25 MB。</small>
      </div>
      <label class="settings-field">
        <span>填充方式</span>
        <select v-model="store.appSettings.backgroundFit" class="option-input" :disabled="!store.appSettings.backgroundImageEnabled || !store.appSettings.backgroundImagePath">
          <option value="cover">智能铺满（随窗口缩放）</option>
          <option value="contain">完整显示（可能留边）</option>
          <option value="stretch">拉伸填满（可能变形）</option>
        </select>
      </label>
      <label class="settings-field">
        <span>对齐位置</span>
        <select v-model="store.appSettings.backgroundPosition" class="option-input" :disabled="!store.appSettings.backgroundImageEnabled || !store.appSettings.backgroundImagePath">
          <option value="center">居中</option>
          <option value="top">顶部</option>
          <option value="bottom">底部</option>
          <option value="left">左侧</option>
          <option value="right">右侧</option>
        </select>
      </label>
      <div
        class="background-focus-preview"
        :class="{ disabled: !store.appSettings.backgroundImageEnabled || !store.appSettings.backgroundImagePath }"
        :style="{ backgroundImage: store.appSettings.backgroundImagePath ? 'var(--custom-background-image)' : undefined, backgroundSize: store.appSettings.backgroundFit === 'stretch' ? '100% 100%' : store.appSettings.backgroundFit, backgroundPosition: `${store.appSettings.backgroundFocusX}% ${store.appSettings.backgroundFocusY}%` }"
        title="点击或拖动，调整背景主体位置"
        @pointerdown="moveBackgroundFocus"
        @pointermove="($event.buttons & 1) && moveBackgroundFocus($event)"
      >
        <span class="background-focus-target" :style="{ left: `${store.appSettings.backgroundFocusX}%`, top: `${store.appSettings.backgroundFocusY}%` }">+</span>
        <small>拖动焦点：{{ Math.round(store.appSettings.backgroundFocusX) }}%, {{ Math.round(store.appSettings.backgroundFocusY) }}%</small>
      </div>
      <div class="focus-range-grid">
        <label class="settings-field"><span>水平焦点</span><span class="range-field appearance-range"><input v-model.number="store.appSettings.backgroundFocusX" type="range" min="0" max="100" step="1" @input="store.appSettings.backgroundPosition = 'center'" /><output>{{ Math.round(store.appSettings.backgroundFocusX) }}%</output></span></label>
        <label class="settings-field"><span>垂直焦点</span><span class="range-field appearance-range"><input v-model.number="store.appSettings.backgroundFocusY" type="range" min="0" max="100" step="1" @input="store.appSettings.backgroundPosition = 'center'" /><output>{{ Math.round(store.appSettings.backgroundFocusY) }}%</output></span></label>
      </div>
      <div class="background-focus-actions">
        <button class="btn btn-ghost btn-sm" type="button" @click="resetBackgroundFocus">焦点居中</button>
        <span>焦点拖动适合人物或产品背景，避免主体被窗口裁切。</span>
      </div>

      <label class="settings-field">
        <span>图片透明度</span>
        <span class="range-field appearance-range">
          <input v-model.number="store.appSettings.backgroundOpacity" type="range" min="0.08" max="1" step="0.02" :disabled="!store.appSettings.backgroundImageEnabled || !store.appSettings.backgroundImagePath" />
          <output>{{ Math.round(store.appSettings.backgroundOpacity * 100) }}%</output>
        </span>
      </label>
      <label class="settings-field">
        <span>背景暗化</span>
        <span class="range-field appearance-range">
          <input v-model.number="store.appSettings.backgroundOverlay" type="range" min="0" max="0.9" step="0.02" :disabled="!store.appSettings.backgroundImageEnabled || !store.appSettings.backgroundImagePath" />
          <output>{{ Math.round(store.appSettings.backgroundOverlay * 100) }}%</output>
        </span>
      </label>
      <label class="settings-field">
        <span>模糊强度</span>
        <span class="range-field appearance-range">
          <input v-model.number="store.appSettings.backgroundBlur" type="range" min="0" max="30" step="1" :disabled="!store.appSettings.backgroundImageEnabled || !store.appSettings.backgroundImagePath" />
          <output>{{ store.appSettings.backgroundBlur }}px</output>
        </span>
      </label>
      <div class="background-preset-block">
        <span class="setting-label">快速效果</span>
        <div class="background-preset-actions">
          <button class="btn btn-ghost btn-sm" type="button" @click="applyBackgroundPreset('clear')">清晰原图</button>
          <button class="btn btn-ghost btn-sm" type="button" @click="applyBackgroundPreset('readable')">文字优先</button>
          <button class="btn btn-ghost btn-sm" type="button" @click="applyBackgroundPreset('soft')">柔和虚化</button>
          <button class="btn btn-ghost btn-sm" type="button" @click="applyBackgroundPreset('vivid')">鲜艳展示</button>
        </div>
      </div>
      <div class="background-adjust-grid">
        <label class="settings-field">
          <span>背景缩放</span>
          <span class="range-field appearance-range"><input v-model.number="store.appSettings.backgroundScale" type="range" min="1" max="2" step="0.01" :disabled="!store.appSettings.backgroundImageEnabled || !store.appSettings.backgroundImagePath" /><output>{{ Math.round(store.appSettings.backgroundScale * 100) }}%</output></span>
        </label>
        <label class="settings-field">
          <span>亮度</span>
          <span class="range-field appearance-range"><input v-model.number="store.appSettings.backgroundBrightness" type="range" min="0.35" max="1.5" step="0.01" :disabled="!store.appSettings.backgroundImageEnabled || !store.appSettings.backgroundImagePath" /><output>{{ Math.round(store.appSettings.backgroundBrightness * 100) }}%</output></span>
        </label>
        <label class="settings-field">
          <span>对比度</span>
          <span class="range-field appearance-range"><input v-model.number="store.appSettings.backgroundContrast" type="range" min="0.5" max="1.8" step="0.01" :disabled="!store.appSettings.backgroundImageEnabled || !store.appSettings.backgroundImagePath" /><output>{{ Math.round(store.appSettings.backgroundContrast * 100) }}%</output></span>
        </label>
        <label class="settings-field">
          <span>饱和度</span>
          <span class="range-field appearance-range"><input v-model.number="store.appSettings.backgroundSaturation" type="range" min="0" max="2" step="0.01" :disabled="!store.appSettings.backgroundImageEnabled || !store.appSettings.backgroundImagePath" /><output>{{ Math.round(store.appSettings.backgroundSaturation * 100) }}%</output></span>
        </label>
        <label class="settings-field">
          <span>暗角</span>
          <span class="range-field appearance-range"><input v-model.number="store.appSettings.backgroundVignette" type="range" min="0" max="0.85" step="0.01" :disabled="!store.appSettings.backgroundImageEnabled || !store.appSettings.backgroundImagePath" /><output>{{ Math.round(store.appSettings.backgroundVignette * 100) }}%</output></span>
        </label>
        <label class="settings-field background-color-field">
          <span>遮罩颜色</span>
          <span class="color-input-row"><input v-model="store.appSettings.backgroundOverlayColor" type="color" :disabled="!store.appSettings.backgroundImageEnabled || !store.appSettings.backgroundImagePath" /><code>{{ store.appSettings.backgroundOverlayColor }}</code></span>
        </label>
      </div>
      <label class="switch-row channel-transparency-switch">
        <span><b>通道背景穿透</b><small>让背景图片透过通道卡片，同时保留文字可读性</small></span>
        <input v-model="store.appSettings.channelTransparencyEnabled" type="checkbox" />
      </label>
      <label class="settings-field">
        <span>通道不透明度</span>
        <span class="range-field appearance-range">
          <input v-model.number="store.appSettings.channelPanelOpacity" type="range" min="0.42" max="1" step="0.02" :disabled="!store.appSettings.channelTransparencyEnabled || !store.appSettings.backgroundImageEnabled || !store.appSettings.backgroundImagePath" />
          <output>{{ Math.round(store.appSettings.channelPanelOpacity * 100) }}%</output>
        </span>
        <small class="range-help">数值越低，背景越明显；建议保持在 65% 以上。</small>
      </label>
    </div>
  </section>

  <section class="settings-section settings-two-column">
    <div class="settings-panel">
      <h3>布局</h3>
      <label class="settings-field">
        <span>工作区宽度</span>
        <select v-model="store.appSettings.workspaceWidth" class="option-input">
          <option value="fluid">铺满窗口</option>
          <option value="wide">宽屏居中</option>
          <option value="focused">专注窄屏</option>
        </select>
      </label>
      <label class="settings-field">
        <span>界面密度</span>
        <select v-model="store.appSettings.density" class="option-input">
          <option value="compact">紧凑</option>
          <option value="comfortable">舒适</option>
          <option value="spacious">宽松</option>
        </select>
      </label>
      <label class="settings-field">
        <span>通道排序</span>
        <select v-model="store.appSettings.channelSort" class="option-input">
          <option value="manual">手动顺序</option>
          <option value="name">按名称</option>
          <option value="category">按分类</option>
          <option value="status">按状态</option>
        </select>
      </label>
      <label class="switch-row">
        <span><b>按分类分组</b><small>在主界面显示分类标题</small></span>
        <input v-model="store.appSettings.groupByCategory" type="checkbox" />
      </label>
      <label class="switch-row">
        <span><b>显示路径说明</b><small>在通道设置中显示实际输出位置预览</small></span>
        <input v-model="store.appSettings.showPathHints" type="checkbox" />
      </label>
      <label class="switch-row">
        <span><b>显示层级示例</b><small>实时展示“目标目录 / 根目录 / 文件”的预计落地路径</small></span>
        <input v-model="store.appSettings.showLayoutExamples" type="checkbox" />
      </label>
      <label class="switch-row">
        <span><b>顶栏紧凑模式</b><small>隐藏副标题并压缩常用按钮间距</small></span>
        <input v-model="store.appSettings.compactTopbar" type="checkbox" />
      </label>
      <label class="switch-row">
        <span><b>工具栏吸顶</b><small>滚动通道时保留搜索与筛选入口</small></span>
        <input v-model="store.appSettings.stickyToolbar" type="checkbox" />
      </label>
    </div>

    <div class="settings-panel">
      <h3>视觉效果</h3>
      <label class="switch-row">
        <span><b>隐藏完成文件</b><small>只隐藏列表项，不删除日志</small></span>
        <input v-model="store.appSettings.hideCompletedFiles" type="checkbox" />
      </label>
      <label class="switch-row">
        <span><b>显示不支持格式</b><small>关闭后仍保留错误日志</small></span>
        <input v-model="store.appSettings.showUnsupportedFiles" type="checkbox" />
      </label>
      <label class="switch-row">
        <span><b>玻璃效果</b><small>玻璃蓝、Win11 和自定义背景的模糊效果</small></span>
        <input v-model="store.appSettings.glassEffects" type="checkbox" />
      </label>
      <label class="switch-row">
        <span><b>减少动画</b><small>适合低性能设备或减少视觉干扰</small></span>
        <input v-model="store.appSettings.reduceMotion" type="checkbox" />
      </label>
      <label class="switch-row">
        <span><b>显示通道编号</b><small>隐藏后只显示名称和分类</small></span>
        <input v-model="store.appSettings.showChannelNumbers" type="checkbox" />
      </label>
      <label class="switch-row">
        <span><b>显示文件大小</b><small>在文件胶囊中显示容量</small></span>
        <input v-model="store.appSettings.showFileSize" type="checkbox" />
      </label>
      <label class="switch-row">
        <span><b>显示压缩格式</b><small>显示 ZIP、7Z、RAR 等格式标签</small></span>
        <input v-model="store.appSettings.showFileFormat" type="checkbox" />
      </label>
    </div>
  </section>

  <section class="settings-section">
    <div class="settings-section-head">
      <div>
        <h3>工作区开关</h3>
        <p>这里统一叫“开关”：打开就显示对应控件，关闭就隐藏。总设置入口始终保留，避免把自己锁在外面。</p>
      </div>
      <div class="maintenance-actions workspace-visibility-actions">
        <button class="btn btn-sm" type="button" @click="applyWorkspaceVisibilityPreset('all')">全部打开</button>
        <button class="btn btn-ghost btn-sm" type="button" @click="applyWorkspaceVisibilityPreset('focused')">精简开关</button>
        <span class="settings-badge">{{ APP_RELEASE_NAME }}</span>
      </div>
    </div>
    <div class="settings-three-column">
      <label class="switch-row"><span><b>顶部并发开关</b><small>控制顶栏并发滑块</small></span><input v-model="store.appSettings.showTopbarConcurrency" type="checkbox" /></label>
      <label class="switch-row"><span><b>快捷设置开关</b><small>控制顶栏快捷设置入口</small></span><input v-model="store.appSettings.showQuickSettings" type="checkbox" /></label>
      <label class="switch-row"><span><b>项目入口开关</b><small>隐藏后仍可使用 Ctrl / Cmd + Shift + P</small></span><input v-model="store.appSettings.showProjectCenterShortcut" type="checkbox" /></label>
      <label class="switch-row"><span><b>任务入口开关</b><small>控制顶栏任务中心入口</small></span><input v-model="store.appSettings.showTaskCenterShortcut" type="checkbox" /></label>
      <label class="switch-row"><span><b>日志入口开关</b><small>控制顶栏日志入口</small></span><input v-model="store.appSettings.showLogsShortcut" type="checkbox" /></label>
      <label class="switch-row"><span><b>全部展开开关</b><small>控制顶栏“全部展开 / 全部收起”控件</small></span><input v-model="store.appSettings.showExpandCollapseControl" type="checkbox" /></label>
      <label class="switch-row"><span><b>全部开始开关</b><small>控制顶栏主开始控件；隐藏后仍可使用 Ctrl / Cmd + Enter</small></span><input v-model="store.appSettings.showGlobalStartControl" type="checkbox" /></label>
      <label class="switch-row"><span><b>工作区搜索开关</b><small>控制通道、备注和文件名搜索框</small></span><input v-model="store.appSettings.showWorkspaceSearch" type="checkbox" /></label>
      <label class="switch-row"><span><b>工作区筛选开关</b><small>控制分类与状态筛选</small></span><input v-model="store.appSettings.showWorkspaceFilters" type="checkbox" /></label>
      <label class="switch-row"><span><b>扫描收件开关</b><small>控制工具栏“扫描收件”快捷入口</small></span><input v-model="store.appSettings.showInboxScanControl" type="checkbox" /></label>
      <label class="switch-row"><span><b>清理 / 重试开关</b><small>控制工具栏失败重试和完成项清理控件</small></span><input v-model="store.appSettings.showWorkspaceCleanupControls" type="checkbox" /></label>
      <label class="switch-row"><span><b>新建通道开关</b><small>控制工作区底部新建通道区域；隐藏后仍可用 Ctrl / Cmd + N</small></span><input v-model="store.appSettings.showAddChannelControl" type="checkbox" /></label>
      <label class="switch-row"><span><b>通道排序开关</b><small>控制每个通道右上角上移 / 下移控件</small></span><input v-model="store.appSettings.showChannelOrderControls" type="checkbox" /></label>
      <label class="switch-row"><span><b>通道复制开关</b><small>控制每个通道右上角复制控件</small></span><input v-model="store.appSettings.showChannelDuplicateControl" type="checkbox" /></label>
      <label class="switch-row"><span><b>通道删除开关</b><small>控制每个通道右上角删除控件</small></span><input v-model="store.appSettings.showChannelDeleteControl" type="checkbox" /></label>
      <label class="switch-row"><span><b>全局命令开关</b><small>控制顶栏“命令”入口；隐藏后仍可使用 Ctrl / Cmd + K</small></span><input v-model="store.appSettings.showCommandPaletteShortcut" type="checkbox" /></label>
      <label class="switch-row"><span><b>最近操作开关</b><small>控制顶栏最近操作入口</small></span><input v-model="store.appSettings.showRecentActionsShortcut" type="checkbox" /></label>
      <label class="switch-row"><span><b>解压历史开关</b><small>控制顶栏解压历史入口；隐藏后仍可在设置中打开</small></span><input v-model="store.appSettings.showExtractionHistoryShortcut" type="checkbox" /></label>
      <label class="switch-row"><span><b>撤销开关</b><small>控制顶栏撤销入口；隐藏后仍可使用 Ctrl / Cmd + Z</small></span><input v-model="store.appSettings.showUndoShortcut" type="checkbox" /></label>
      <label class="switch-row"><span><b>通道自动化方案开关</b><small>控制每个通道中的四种自动化快捷方案</small></span><input v-model="store.appSettings.showChannelAutomationControls" type="checkbox" /></label>
      <label class="switch-row"><span><b>品牌副标题开关</b><small>控制左上角“多通道批量解压”说明</small></span><input v-model="store.appSettings.showBrandSubtitle" type="checkbox" /></label>
      <label class="switch-row"><span><b>列标题开关</b><small>控制通道 / 文件队列 / 进度 / 操作标题行</small></span><input v-model="store.appSettings.showColumnHeaders" type="checkbox" /></label>
      <label class="switch-row"><span><b>工具栏统计开关</b><small>控制“显示 x/y 个通道”统计</small></span><input v-model="store.appSettings.showToolbarSummary" type="checkbox" /></label>
      <label class="switch-row"><span><b>底部状态栏开关</b><small>控制通道、文件、项目和任务统计栏</small></span><input v-model="store.appSettings.showStatusBar" type="checkbox" /></label>
      <label class="switch-row"><span><b>快捷键提示开关</b><small>控制工具栏右侧快捷键说明文字</small></span><input v-model="store.appSettings.showShortcutHints" type="checkbox" /></label>
    </div>
  </section>
</template>
