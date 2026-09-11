import { convertFileSrc } from '@tauri-apps/api/core';
import { FONT_DEFINITIONS } from '../config/appearance';
import type { AppSettings } from '../types';

const FALLBACK_FONT = 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

function customFontStack(value: string): string {
  const family = value.trim().replace(/[;{}<>]/g, '').slice(0, 120);
  if (!family) return FALLBACK_FONT;
  const escaped = family.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}", "Microsoft YaHei UI", "Segoe UI", sans-serif`;
}

function fontStack(settings: AppSettings): string {
  if (settings.fontPreset === 'custom') return customFontStack(settings.customFontFamily);
  return FONT_DEFINITIONS.find((item) => item.id === settings.fontPreset)?.stack ?? FALLBACK_FONT;
}

function backgroundAsset(path: string): string {
  if (!path.trim()) return '';
  try {
    return convertFileSrc(path.trim());
  } catch {
    return '';
  }
}

function cssUrl(value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '%22');
  return `url("${escaped}")`;
}

export function applyAppearanceSettings(settings: AppSettings): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', settings.theme);
  root.setAttribute('data-density', settings.density);
  root.setAttribute('data-motion', settings.reduceMotion ? 'reduce' : 'full');
  root.setAttribute('data-glass', settings.glassEffects ? 'on' : 'off');
  root.setAttribute('data-compact-topbar', settings.compactTopbar ? 'on' : 'off');

  root.style.setProperty('--font-ui', fontStack(settings));
  root.style.setProperty('--font-weight-ui', String(settings.fontWeight));

  const asset = settings.backgroundImageEnabled ? backgroundAsset(settings.backgroundImagePath) : '';
  root.setAttribute('data-background-enabled', settings.backgroundImageEnabled ? 'on' : 'off');
  root.setAttribute('data-custom-background', asset ? 'on' : 'off');
  root.setAttribute('data-channel-transparency', settings.channelTransparencyEnabled ? 'on' : 'off');
  root.style.setProperty('--custom-background-image', asset ? cssUrl(asset) : 'none');
  root.style.setProperty('--custom-background-opacity', String(settings.backgroundOpacity));
  root.style.setProperty('--custom-background-blur', `${settings.backgroundBlur}px`);
  root.style.setProperty('--custom-background-overlay', String(settings.backgroundOverlay));
  root.style.setProperty('--custom-background-overlay-color', settings.backgroundOverlayColor);
  root.style.setProperty('--custom-background-scale', String(settings.backgroundScale));
  root.style.setProperty('--custom-background-brightness', String(settings.backgroundBrightness));
  root.style.setProperty('--custom-background-contrast', String(settings.backgroundContrast));
  root.style.setProperty('--custom-background-saturation', String(settings.backgroundSaturation));
  root.style.setProperty('--custom-background-vignette', String(settings.backgroundVignette));
  root.style.setProperty('--custom-background-size', settings.backgroundFit === 'stretch' ? '100% 100%' : settings.backgroundFit);
  const presetPositions: Record<AppSettings['backgroundPosition'], [number, number]> = {
    center: [settings.backgroundFocusX, settings.backgroundFocusY],
    top: [settings.backgroundFocusX, 0],
    bottom: [settings.backgroundFocusX, 100],
    left: [0, settings.backgroundFocusY],
    right: [100, settings.backgroundFocusY],
  };
  const [focusX, focusY] = presetPositions[settings.backgroundPosition];
  root.style.setProperty('--custom-background-position', `${focusX}% ${focusY}%`);
  root.style.setProperty('--channel-panel-opacity', `${Math.round(settings.channelPanelOpacity * 100)}%`);
}
