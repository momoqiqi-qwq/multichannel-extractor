use super::error::ArchiveError;
use std::ffi::OsString;
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};

pub(super) fn ensure_no_symlink_path(destination: &Path, candidate: &Path) -> Result<(), ArchiveError> {
    if !candidate.starts_with(destination) {
        return Err(ArchiveError::InvalidPath(format!(
            "目标路径越过解压目录：{}",
            candidate.display()
        )));
    }

    let relative = candidate
        .strip_prefix(destination)
        .map_err(|error| ArchiveError::InvalidPath(error.to_string()))?;
    let mut cursor = destination.to_path_buf();
    check_not_symlink(&cursor)?;
    for component in relative.components() {
        if let Component::Normal(value) = component {
            cursor.push(value);
            match fs::symlink_metadata(&cursor) {
                Ok(metadata) if metadata.file_type().is_symlink() => {
                    return Err(ArchiveError::InvalidPath(format!(
                        "拒绝写入符号链接路径：{}",
                        cursor.display()
                    )));
                }
                Ok(_) => {}
                Err(error) if error.kind() == io::ErrorKind::NotFound => break,
                Err(error) => return Err(ArchiveError::Io(error)),
            }
        }
    }
    Ok(())
}

fn check_not_symlink(path: &Path) -> Result<(), ArchiveError> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => Err(ArchiveError::InvalidPath(format!(
            "拒绝使用符号链接作为解压目录：{}",
            path.display()
        ))),
        Ok(_) => Ok(()),
        Err(error) => Err(ArchiveError::Io(error)),
    }
}

pub(super) fn is_junk_path(path: &Path) -> bool {
    let components = normal_components(path);
    if components
        .iter()
        .any(|component| component.to_string_lossy().eq_ignore_ascii_case("__MACOSX"))
    {
        return true;
    }
    let Some(name) = components.last().map(|value| value.to_string_lossy()) else {
        return false;
    };
    name.eq_ignore_ascii_case(".DS_Store")
        || name.eq_ignore_ascii_case("Thumbs.db")
        || name.eq_ignore_ascii_case("desktop.ini")
        || name.starts_with("._")
}

pub(super) fn normal_components(path: &Path) -> Vec<OsString> {
    path.components()
        .filter_map(|component| match component {
            Component::Normal(value) => Some(value.to_os_string()),
            _ => None,
        })
        .collect()
}

pub(super) fn safe_archive_path(path: &Path) -> Option<PathBuf> {
    let mut safe = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(value) => safe.push(value),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => return None,
        }
    }
    (!safe.as_os_str().is_empty()).then_some(safe)
}
