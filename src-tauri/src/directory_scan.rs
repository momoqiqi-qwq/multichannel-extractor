use crate::archive::inspect_path;
use crate::models::{
    ArchiveDirectoryCandidate, ArchiveDirectoryScanRequest, ArchiveDirectoryScanResult,
};
use std::cmp::Ordering;
use std::fs;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

const PRE_RELEASE_MARKERS: &[&str] = &[
    "alpha", "beta", "preview", "pre", "rc", "dev", "snapshot", "nightly", "canary",
];

pub fn scan_archive_directory(
    request: ArchiveDirectoryScanRequest,
) -> Result<ArchiveDirectoryScanResult, String> {
    let directory = existing_directory(&request.directory)?;
    let keywords = normalize_keywords(request.keywords);
    if keywords.is_empty() {
        return Err("请至少填写一个关键词".to_string());
    }

    let match_all = request.match_mode.eq_ignore_ascii_case("all");
    let max_candidates = request.max_candidates.clamp(1, 500);
    let walker = if request.recursive {
        WalkDir::new(&directory).max_depth(12)
    } else {
        WalkDir::new(&directory).max_depth(1)
    };

    let mut scanned_files = 0usize;
    let mut matched_files = 0usize;
    let mut candidates = Vec::new();

    for entry in walker.into_iter().filter_map(Result::ok) {
        if !entry.file_type().is_file() {
            continue;
        }
        scanned_files += 1;
        let path = entry.path();
        let inspected = inspect_path(path);
        if !inspected.supported {
            continue;
        }

        let name_lower = inspected.name.to_lowercase();
        let matched_keywords: Vec<String> = keywords
            .iter()
            .filter(|keyword| name_lower.contains(keyword.as_str()))
            .cloned()
            .collect();
        let matched = if match_all {
            matched_keywords.len() == keywords.len()
        } else {
            !matched_keywords.is_empty()
        };
        if !matched {
            continue;
        }

        let prerelease = is_prerelease(&name_lower);
        if prerelease && !request.include_prerelease {
            continue;
        }
        matched_files += 1;
        let (version_label, version_parts) = extract_version(&inspected.name);
        let modified_unix = fs::metadata(path)
            .ok()
            .and_then(|metadata| metadata.modified().ok())
            .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
            .map(|value| value.as_secs())
            .unwrap_or(0);

        candidates.push(ArchiveDirectoryCandidate {
            path: inspected.path,
            name: inspected.name,
            size: inspected.size,
            format: inspected.format,
            version_label,
            version_parts,
            modified_unix,
            matched_keywords,
            prerelease,
        });
    }

    candidates
        .sort_by(|left, right| compare_candidates(left, right, request.prefer_highest_version));
    let selected = candidates.first();
    let selected_path = selected.map(|item| item.path.clone());
    let selected_name = selected.map(|item| item.name.clone());
    let selection_reason = match selected {
        None => "没有找到符合关键词的受支持压缩文件".to_string(),
        Some(item) if request.prefer_highest_version && !item.version_parts.is_empty() => {
            format!(
                "已按版本号优先选择 {}{}",
                item.name,
                item.version_label
                    .as_ref()
                    .map(|value| format!("（版本 {value}）"))
                    .unwrap_or_default()
            )
        }
        Some(item) => format!("未识别到明确版本号，已按最近修改时间选择 {}", item.name),
    };

    candidates.truncate(max_candidates);
    Ok(ArchiveDirectoryScanResult {
        directory: directory.to_string_lossy().to_string(),
        keywords,
        candidates,
        selected_path,
        selected_name,
        selection_reason,
        scanned_files,
        matched_files,
    })
}

fn existing_directory(value: &str) -> Result<PathBuf, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("扫描目录为空".to_string());
    }
    let path = PathBuf::from(trimmed);
    if !path.is_dir() {
        return Err(format!("扫描目录不存在或不是文件夹：{}", path.display()));
    }
    path.canonicalize()
        .map_err(|error| format!("无法读取扫描目录：{error}"))
}

fn normalize_keywords(values: Vec<String>) -> Vec<String> {
    let mut normalized = Vec::new();
    for value in values {
        for token in value.split(|character: char| {
            character == ','
                || character == ';'
                || character == '，'
                || character == '；'
                || character == '\n'
                || character == '\r'
        }) {
            let keyword = token.trim().to_lowercase();
            if !keyword.is_empty() && !normalized.contains(&keyword) {
                normalized.push(keyword);
            }
        }
    }
    normalized
}

fn is_prerelease(name_lower: &str) -> bool {
    PRE_RELEASE_MARKERS
        .iter()
        .any(|marker| name_lower.contains(marker))
}

fn archive_stem(name: &str) -> &str {
    let lower = name.to_lowercase();
    const EXTENSIONS: &[&str] = &[
        ".tar.gz", ".tar.bz2", ".tar.xz", ".tbz2", ".tbz", ".tgz", ".txz", ".zip", ".rar", ".7z",
        ".tar", ".gz", ".bz2", ".xz",
    ];
    for extension in EXTENSIONS {
        if lower.ends_with(extension) {
            return &name[..name.len() - extension.len()];
        }
    }
    name
}

fn extract_version(name: &str) -> (Option<String>, Vec<u64>) {
    let stem = archive_stem(name);
    let chars: Vec<char> = stem.chars().collect();
    let lower_chars: Vec<char> = stem.to_lowercase().chars().collect();
    let ranges = digit_ranges(&chars);
    if ranges.is_empty() {
        return (None, Vec::new());
    }

    let start_index = preferred_version_start(&lower_chars)
        .and_then(|start| {
            ranges
                .iter()
                .position(|(range_start, _)| *range_start >= start)
        })
        .unwrap_or_else(|| best_numeric_group_start(&lower_chars, &ranges));
    let parts = collect_numeric_group(&chars, &lower_chars, &ranges, start_index);
    if parts.is_empty() {
        return (None, parts);
    }
    let label = parts
        .iter()
        .map(u64::to_string)
        .collect::<Vec<_>>()
        .join(".");
    (Some(label), parts)
}

fn preferred_version_start(chars: &[char]) -> Option<usize> {
    let text: String = chars.iter().collect();
    let mut starts = Vec::new();
    for marker in ["version", "release", "版本", "ver"] {
        for (byte_index, _) in text.match_indices(marker) {
            let char_index = text[..byte_index].chars().count();
            let before = char_index.checked_sub(1).and_then(|index| chars.get(index));
            if before.is_some_and(|character| character.is_alphanumeric()) {
                continue;
            }
            let after = char_index + marker.chars().count();
            if next_non_separator_is_digit(chars, after) {
                starts.push(after);
            }
        }
    }
    for (index, character) in chars.iter().enumerate() {
        if *character != 'v' {
            continue;
        }
        let before = index.checked_sub(1).and_then(|value| chars.get(value));
        if before.is_some_and(|value| value.is_alphanumeric()) {
            continue;
        }
        if next_non_separator_is_digit(chars, index + 1) {
            starts.push(index + 1);
        }
    }
    starts.into_iter().max()
}

fn next_non_separator_is_digit(chars: &[char], start: usize) -> bool {
    chars
        .iter()
        .skip(start)
        .find(|character| !is_version_separator(**character))
        .is_some_and(|character| character.is_ascii_digit())
}

fn is_version_separator(character: char) -> bool {
    character == '.' || character == '-' || character == '_' || character.is_whitespace()
}

fn numeric_group_length(chars: &[char], ranges: &[(usize, usize)], start_index: usize) -> usize {
    let mut length = 1;
    let mut end_index = ranges[start_index].1;
    for (range_start, range_end) in ranges.iter().skip(start_index + 1) {
        if chars[end_index..*range_start]
            .iter()
            .all(|character| is_version_separator(*character))
        {
            length += 1;
            end_index = *range_end;
        } else {
            break;
        }
    }
    length
}

fn best_numeric_group_start(chars: &[char], ranges: &[(usize, usize)]) -> usize {
    ranges
        .iter()
        .enumerate()
        .max_by_key(|(index, _)| (numeric_group_length(chars, ranges, *index), *index))
        .map(|(index, _)| index)
        .unwrap_or(0)
}

fn collect_numeric_group(
    chars: &[char],
    lower_chars: &[char],
    ranges: &[(usize, usize)],
    start_index: usize,
) -> Vec<u64> {
    let mut parts = Vec::new();
    let mut end_index = ranges[start_index].1;
    for (range_start, range_end) in ranges.iter().skip(start_index) {
        if !parts.is_empty()
            && !lower_chars[end_index..*range_start]
                .iter()
                .all(|character| is_version_separator(*character))
        {
            break;
        }
        let value: String = chars[*range_start..*range_end].iter().collect();
        if let Ok(number) = value.parse::<u64>() {
            parts.push(number);
            end_index = *range_end;
            if parts.len() >= 6 {
                break;
            }
        }
    }
    parts
}

fn digit_ranges(chars: &[char]) -> Vec<(usize, usize)> {
    let mut ranges = Vec::new();
    let mut start = None;
    for (index, character) in chars.iter().enumerate() {
        if character.is_ascii_digit() {
            start.get_or_insert(index);
        } else if let Some(value) = start.take() {
            ranges.push((value, index));
        }
    }
    if let Some(value) = start {
        ranges.push((value, chars.len()));
    }
    ranges
}

fn compare_versions(left: &[u64], right: &[u64]) -> Ordering {
    let count = left.len().max(right.len());
    for index in 0..count {
        let left_value = *left.get(index).unwrap_or(&0);
        let right_value = *right.get(index).unwrap_or(&0);
        match right_value.cmp(&left_value) {
            Ordering::Equal => {}
            ordering => return ordering,
        }
    }
    Ordering::Equal
}

fn compare_candidates(
    left: &ArchiveDirectoryCandidate,
    right: &ArchiveDirectoryCandidate,
    prefer_highest_version: bool,
) -> Ordering {
    if prefer_highest_version {
        match compare_versions(&left.version_parts, &right.version_parts) {
            Ordering::Equal => {}
            ordering => return ordering,
        }
        match left.prerelease.cmp(&right.prerelease) {
            Ordering::Equal => {}
            ordering => return ordering,
        }
    }
    match right.modified_unix.cmp(&left.modified_unix) {
        Ordering::Equal => left.name.to_lowercase().cmp(&right.name.to_lowercase()),
        ordering => ordering,
    }
}

#[cfg(test)]
mod tests {
    use super::{compare_versions, extract_version};
    use std::cmp::Ordering;

    #[test]
    fn extracts_semver_like_values() {
        assert_eq!(extract_version("project-v2.10.3.zip").1, vec![2, 10, 3]);
        assert_eq!(
            extract_version("产品_版本_2026.07.1.7z").1,
            vec![2026, 7, 1]
        );
        assert_eq!(extract_version("movie-1080p-v2.10.zip").1, vec![2, 10]);
        assert_eq!(extract_version("build-1080p-2.11.zip").1, vec![2, 11]);
    }

    #[test]
    fn compares_versions_numerically() {
        assert_eq!(compare_versions(&[1, 10], &[1, 9]), Ordering::Less);
        assert_eq!(compare_versions(&[2, 0], &[10]), Ordering::Greater);
        assert_eq!(compare_versions(&[1, 2], &[1, 2, 0]), Ordering::Equal);
    }
}
