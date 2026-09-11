import type { KeywordMatchMode } from '../types';

const ARCHIVE_SUFFIX_RE = /\.(?:tar\.(?:gz|bz2|xz)|tbz2?|tgz|txz|zip|rar|7z|tar|gz|bz2|xz)$/i;
const VERSION_TOKEN_RE = /^(?:v|ver|version|release|版本)?\d+(?:[._-]\d+){0,4}[a-z]?$/i;
const DATE_TOKEN_RE = /^(?:19|20)\d{2}(?:[._-]?(?:0?[1-9]|1[0-2]))?(?:[._-]?(?:0?[1-9]|[12]\d|3[01]))?$/;
const NOISE_TOKENS = new Set([
  'archive',
  'build',
  'download',
  'final',
  'full',
  'installer',
  'latest',
  'new',
  'package',
  'portable',
  'release',
  'setup',
  'stable',
  'update',
  'updated',
]);

export function parseChannelKeywords(value: string): string[] {
  return value
    .split(/[\n\r,;，；]+/)
    .map((item) => item.trim())
    .filter((item, index, list) => Boolean(item) && list.findIndex((candidate) => candidate.toLocaleLowerCase() === item.toLocaleLowerCase()) === index);
}

function normalizeComparable(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s._()[\]{}]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function isNoiseToken(token: string): boolean {
  const normalized = token.toLocaleLowerCase();
  if (!normalized || normalized.length === 1) return true;
  if (NOISE_TOKENS.has(normalized)) return true;
  if (VERSION_TOKEN_RE.test(normalized) || DATE_TOKEN_RE.test(normalized)) return true;
  return false;
}

export function extractArchiveKeywords(fileName: string): string[] {
  const stem = fileName.replace(ARCHIVE_SUFFIX_RE, '');
  const spaced = stem
    .normalize('NFKC')
    .replace(/([a-z\p{L}])([A-Z])/gu, '$1 $2')
    .replace(/[\s._()[\]{}]+/g, '-')
    .replace(/-+/g, '-');

  const tokens = spaced
    .split('-')
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !isNoiseToken(token));

  const unique = tokens.filter((token, index, list) =>
    list.findIndex((candidate) => candidate.toLocaleLowerCase() === token.toLocaleLowerCase()) === index,
  );

  if (unique.length <= 5) return unique;

  // Keep the product identity at the front, plus platform/architecture qualifiers at the tail.
  const qualifiers = unique.filter((token) => /^(?:win(?:dows)?|linux|mac(?:os)?|osx|x64|x86|amd64|arm64|aarch64|arm)$/i.test(token));
  const identity = unique.filter((token) => !qualifiers.includes(token)).slice(0, Math.max(1, 5 - qualifiers.length));
  return [...identity, ...qualifiers].slice(0, 5);
}

export interface KeywordMatchScore {
  matched: boolean;
  score: number;
  matchedKeywords: string[];
}

export function scoreFileNameAgainstKeywords(fileName: string, keywords: string[], mode: KeywordMatchMode): KeywordMatchScore {
  if (!keywords.length) return { matched: false, score: 0, matchedKeywords: [] };
  const haystack = normalizeComparable(fileName.replace(ARCHIVE_SUFFIX_RE, ''));
  const matchedKeywords = keywords.filter((keyword) => {
    const needle = normalizeComparable(keyword);
    return Boolean(needle) && haystack.includes(needle);
  });
  const matched = mode === 'all' ? matchedKeywords.length === keywords.length : matchedKeywords.length > 0;
  if (!matched) return { matched: false, score: 0, matchedKeywords };
  const coverage = matchedKeywords.reduce((sum, keyword) => sum + normalizeComparable(keyword).length, 0);
  return {
    matched: true,
    score: matchedKeywords.length * 1000 + coverage,
    matchedKeywords,
  };
}
