/** Cross-platform path helpers for UI-only previews. Rust remains the source of truth. */
export function parentDirectory(path: string): string {
  const normalized = path.trim().replace(/[\\/]+$/, '');
  const index = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  if (index < 0) return '';
  if (index === 2 && /^[A-Za-z]:/.test(normalized)) return normalized.slice(0, 3);
  return normalized.slice(0, index) || normalized.slice(0, 1);
}

export function normalizePathInput(path: string): string {
  return path.trim().replace(/^(["'])|(["'])$/g, '');
}

export function displayPath(path: string, maxLength = 72): string {
  const value = path.trim();
  if (value.length <= maxLength) return value;
  const head = Math.max(18, Math.floor(maxLength * 0.42));
  const tail = Math.max(24, maxLength - head - 1);
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
