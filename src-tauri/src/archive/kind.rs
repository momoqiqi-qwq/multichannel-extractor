use super::ArchiveError;
use std::ffi::{OsStr, OsString};
use std::path::Path;

#[derive(Debug, Clone, Copy)]
pub(super) enum ArchiveKind {
    Zip,
    SevenZip,
    Rar,
    Tar,
    TarGz,
    TarBz2,
    TarXz,
    Gz,
    Bz2,
    Xz,
}

impl ArchiveKind {
    pub(super) fn label(self) -> &'static str {
        match self {
            Self::Zip => "ZIP",
            Self::SevenZip => "7Z",
            Self::Rar => "RAR",
            Self::Tar => "TAR",
            Self::TarGz => "TAR.GZ",
            Self::TarBz2 => "TAR.BZ2",
            Self::TarXz => "TAR.XZ",
            Self::Gz => "GZ",
            Self::Bz2 => "BZ2",
            Self::Xz => "XZ",
        }
    }
}

pub(super) fn archive_folder_name(path: &Path) -> Result<OsString, ArchiveError> {
    let name = path
        .file_name()
        .ok_or_else(|| ArchiveError::InvalidPath("压缩文件缺少文件名".to_string()))?
        .to_string_lossy();
    let lower = name.to_ascii_lowercase();
    let suffixes = [
        ".tar.gz", ".tar.bz2", ".tar.xz", ".tbz2", ".tbz", ".tgz", ".txz", ".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz",
    ];
    let mut stem = name.as_ref();
    for suffix in suffixes {
        if lower.ends_with(suffix) {
            let next_len = stem.len().saturating_sub(suffix.len());
            stem = &stem[..next_len];
            break;
        }
    }
    let cleaned: String = stem
        .chars()
        .map(|character| match character {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            value if value.is_control() => '_',
            value => value,
        })
        .collect();
    let cleaned = cleaned
        .trim()
        .trim_end_matches(|character| character == '.' || character == ' ');
    Ok(OsString::from(if cleaned.is_empty() { "extracted" } else { cleaned }))
}

pub(super) fn detect_kind(path: &Path) -> Option<ArchiveKind> {
    let name = path.file_name()?.to_string_lossy().to_ascii_lowercase();
    if name.ends_with(".tar.gz") || name.ends_with(".tgz") {
        Some(ArchiveKind::TarGz)
    } else if name.ends_with(".tar.bz2") || name.ends_with(".tbz2") || name.ends_with(".tbz") {
        Some(ArchiveKind::TarBz2)
    } else if name.ends_with(".tar.xz") || name.ends_with(".txz") {
        Some(ArchiveKind::TarXz)
    } else if name.ends_with(".zip") {
        Some(ArchiveKind::Zip)
    } else if name.ends_with(".7z") {
        Some(ArchiveKind::SevenZip)
    } else if name.ends_with(".rar") {
        Some(ArchiveKind::Rar)
    } else if name.ends_with(".tar") {
        Some(ArchiveKind::Tar)
    } else if name.ends_with(".gz") {
        Some(ArchiveKind::Gz)
    } else if name.ends_with(".bz2") {
        Some(ArchiveKind::Bz2)
    } else if name.ends_with(".xz") {
        Some(ArchiveKind::Xz)
    } else {
        None
    }
}

