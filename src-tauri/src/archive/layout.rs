use super::check_cancel;
use super::collision::copy_with_policy;
use super::error::ArchiveError;
use super::path_safety::{ensure_no_symlink_path, is_junk_path, normal_components};
use crate::models::{CollisionPolicy, DepthMode};
use std::collections::HashSet;
use std::ffi::{OsStr, OsString};
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};
use crate::task_control::TaskControl;
use walkdir::WalkDir;

#[derive(Debug, Clone, Default)]
pub(super) struct MaterializeReport {
    pub written_files: Vec<PathBuf>,
    pub replaced_files: Vec<PathBuf>,
    pub created_directories: Vec<PathBuf>,
}


pub(super) fn materialize<F>(
    raw_dir: &Path,
    destination: &Path,
    mode: &DepthMode,
    collision_policy: CollisionPolicy,
    skip_junk_files: bool,
    keep_empty_directories: bool,
    deduplicate_archive_root: bool,
    archive_wrapper_name: Option<&OsStr>,
    cancel: &TaskControl,
    progress: &mut F,
) -> Result<MaterializeReport, ArchiveError>
where
    F: FnMut(u8, &'static str, String),
{
    ensure_no_symlink_path(destination, destination)?;
    let mut files = Vec::new();
    let mut directories = Vec::new();
    for entry in WalkDir::new(raw_dir).follow_links(false) {
        let entry = entry.map_err(|error| ArchiveError::Io(io::Error::other(error)))?;
        let relative = entry
            .path()
            .strip_prefix(raw_dir)
            .map_err(|error| ArchiveError::InvalidPath(error.to_string()))?
            .to_path_buf();
        if relative.as_os_str().is_empty() || (skip_junk_files && is_junk_path(&relative)) {
            continue;
        }
        if entry.file_type().is_file() {
            files.push((entry.path().to_path_buf(), relative));
        } else if entry.file_type().is_dir() {
            directories.push(relative);
        }
    }

    let single_outer = single_outer_directory(&files);
    let strip_outer = should_strip_outer(
        mode,
        single_outer.as_deref(),
        deduplicate_archive_root,
        archive_wrapper_name,
    );
    if let Some(root) = single_outer.as_deref().filter(|_| strip_outer) {
        let reason = if matches!(mode, DepthMode::SkipOuter) {
            "跳过单一外层目录"
        } else {
            "避免同名输出目录重复嵌套"
        };
        progress(73, "arranging", format!("{reason}：{}", root.to_string_lossy()));
    }

    let mut report = MaterializeReport::default();
    let mut tracked_directories = HashSet::<PathBuf>::new();

    if keep_empty_directories {
        directories.sort_by_key(|path| normal_components(path).len());
        directories.dedup();
        for relative in directories {
            check_cancel(cancel)?;
            let mapped = map_directory_path(&relative, mode, strip_outer);
            if !mapped.as_os_str().is_empty() {
                ensure_directory(
                    &destination.join(mapped),
                    destination,
                    &mut report.created_directories,
                    &mut tracked_directories,
                )?;
            }
        }
    }

    let total = files.len().max(1);
    for (index, (source, relative)) in files.into_iter().enumerate() {
        check_cancel(cancel)?;
        let mapped = map_relative_path(&relative, mode, strip_outer)?;
        let desired = destination.join(mapped);
        if let Some(parent) = desired.parent() {
            ensure_directory(
                parent,
                destination,
                &mut report.created_directories,
                &mut tracked_directories,
            )?;
        }
        ensure_no_symlink_path(destination, &desired)?;
        let outcome = copy_with_policy(&source, &desired, collision_policy, cancel)?;
        if let Some(path) = outcome.path {
            if outcome.replaced {
                report.replaced_files.push(path.clone());
            }
            report.written_files.push(path);
        }
        let percent = 73 + (((index + 1) * 26 / total) as u8);
        progress(
            percent.min(99),
            "arranging",
            format!("正在写入文件 {}/{}", index + 1, total),
        );
    }
    Ok(report)
}

fn ensure_directory(
    directory: &Path,
    destination: &Path,
    created: &mut Vec<PathBuf>,
    tracked: &mut HashSet<PathBuf>,
) -> Result<(), ArchiveError> {
    ensure_no_symlink_path(destination, directory)?;
    if directory.exists() {
        if !directory.is_dir() {
            return Err(ArchiveError::InvalidPath(format!(
                "目标路径不是目录：{}",
                directory.display()
            )));
        }
        return Ok(());
    }

    let mut missing = Vec::new();
    let mut cursor = directory;
    while !cursor.exists() && cursor.starts_with(destination) {
        missing.push(cursor.to_path_buf());
        let Some(parent) = cursor.parent() else { break };
        cursor = parent;
    }
    fs::create_dir_all(directory)?;
    for path in missing.into_iter().rev() {
        if path != destination && tracked.insert(path.clone()) {
            created.push(path);
        }
    }
    Ok(())
}

pub(super) fn single_outer_directory(files: &[(PathBuf, PathBuf)]) -> Option<OsString> {
    if files.is_empty() {
        return None;
    }
    let mut root: Option<OsString> = None;
    for (_, relative) in files {
        let components = normal_components(relative);
        if components.len() < 2 {
            return None;
        }
        match root.as_ref() {
            Some(existing) if !os_eq_ignore_ascii_case(existing, &components[0]) => return None,
            None => root = Some(components[0].clone()),
            _ => {}
        }
    }
    root
}

pub(super) fn should_strip_outer(
    mode: &DepthMode,
    single_outer: Option<&OsStr>,
    deduplicate_archive_root: bool,
    archive_wrapper_name: Option<&OsStr>,
) -> bool {
    let Some(root) = single_outer else {
        return false;
    };
    if matches!(mode, DepthMode::SkipOuter) {
        return true;
    }
    deduplicate_archive_root
        && archive_wrapper_name
            .map(|wrapper| os_eq_ignore_ascii_case(wrapper, root))
            .unwrap_or(false)
}

fn os_eq_ignore_ascii_case(left: &OsStr, right: &OsStr) -> bool {
    left.to_string_lossy().eq_ignore_ascii_case(&right.to_string_lossy())
}

pub(super) fn map_relative_path(
    relative: &Path,
    mode: &DepthMode,
    strip_outer: bool,
) -> Result<PathBuf, ArchiveError> {
    let mut components = normal_components(relative);
    if components.is_empty() {
        return Err(ArchiveError::InvalidPath(
            "归档条目缺少有效文件名".to_string(),
        ));
    }
    if strip_outer && components.len() > 1 {
        components.remove(0);
    }

    let mut output = PathBuf::new();
    match mode {
        DepthMode::Preserve | DepthMode::SkipOuter => {
            for component in components {
                output.push(component);
            }
        }
        DepthMode::Flatten { depth } => {
            let file_name = components
                .pop()
                .ok_or_else(|| ArchiveError::InvalidPath("归档条目缺少文件名".to_string()))?;
            for component in components.into_iter().take(*depth) {
                output.push(component);
            }
            output.push(file_name);
        }
    }
    Ok(output)
}

pub(super) fn map_directory_path(relative: &Path, mode: &DepthMode, strip_outer: bool) -> PathBuf {
    let mut components = normal_components(relative);
    if strip_outer && !components.is_empty() {
        components.remove(0);
    }
    let keep = match mode {
        DepthMode::Flatten { depth } => *depth,
        DepthMode::Preserve | DepthMode::SkipOuter => components.len(),
    };
    components.into_iter().take(keep).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::task_control::TaskControl;

    fn write_fixture(root: &Path, relative: &str, content: &[u8]) {
        let path = root.join(relative);
        fs::create_dir_all(path.parent().expect("fixture parent")).expect("create fixture parent");
        fs::write(path, content).expect("write fixture");
    }

    fn run_materialize(
        raw: &Path,
        destination: &Path,
        mode: DepthMode,
        policy: CollisionPolicy,
        deduplicate_archive_root: bool,
        archive_wrapper_name: Option<&OsStr>,
    ) -> MaterializeReport {
        let cancel = TaskControl::default();
        materialize(
            raw,
            destination,
            &mode,
            policy,
            false,
            true,
            deduplicate_archive_root,
            archive_wrapper_name,
            &cancel,
            &mut |_, _, _| {},
        )
        .expect("materialize succeeds")
    }

    #[test]
    fn preserve_materializes_full_structure() {
        let temp = tempfile::TempDir::new().expect("temp dir");
        let raw = temp.path().join("raw");
        let output = temp.path().join("output");
        write_fixture(&raw, "root/assets/icons/icon.txt", b"icon");

        let report = run_materialize(
            &raw,
            &output,
            DepthMode::Preserve,
            CollisionPolicy::Overwrite,
            false,
            None,
        );

        assert_eq!(fs::read(output.join("root/assets/icons/icon.txt")).unwrap(), b"icon");
        assert_eq!(report.written_files.len(), 1);
    }

    #[test]
    fn flatten_materializes_requested_depth() {
        let temp = tempfile::TempDir::new().expect("temp dir");
        let raw = temp.path().join("raw");
        let output = temp.path().join("output");
        write_fixture(&raw, "root/assets/icons/icon.txt", b"icon");

        run_materialize(
            &raw,
            &output,
            DepthMode::Flatten { depth: 2 },
            CollisionPolicy::Overwrite,
            false,
            None,
        );

        assert_eq!(fs::read(output.join("root/assets/icon.txt")).unwrap(), b"icon");
        assert!(!output.join("root/assets/icons/icon.txt").exists());
    }

    #[test]
    fn skip_outer_materializes_without_single_root() {
        let temp = tempfile::TempDir::new().expect("temp dir");
        let raw = temp.path().join("raw");
        let output = temp.path().join("output");
        write_fixture(&raw, "package/assets/icon.txt", b"icon");
        write_fixture(&raw, "package/readme.txt", b"readme");

        run_materialize(
            &raw,
            &output,
            DepthMode::SkipOuter,
            CollisionPolicy::Overwrite,
            false,
            None,
        );

        assert_eq!(fs::read(output.join("assets/icon.txt")).unwrap(), b"icon");
        assert_eq!(fs::read(output.join("readme.txt")).unwrap(), b"readme");
        assert!(!output.join("package").exists());
    }

    #[test]
    fn matching_archive_wrapper_does_not_double_nest() {
        let temp = tempfile::TempDir::new().expect("temp dir");
        let raw = temp.path().join("raw");
        let output = temp.path().join("multichannel-extractor");
        write_fixture(&raw, "multichannel-extractor/src/main.ts", b"main");

        run_materialize(
            &raw,
            &output,
            DepthMode::Preserve,
            CollisionPolicy::Overwrite,
            true,
            Some(OsStr::new("multichannel-extractor")),
        );

        assert_eq!(fs::read(output.join("src/main.ts")).unwrap(), b"main");
        assert!(!output.join("multichannel-extractor/src/main.ts").exists());
    }

    #[test]
    fn overwrite_policy_replaces_existing_file() {
        let temp = tempfile::TempDir::new().expect("temp dir");
        let raw = temp.path().join("raw");
        let output = temp.path().join("output");
        write_fixture(&raw, "root/file.txt", b"new");
        fs::create_dir_all(output.join("root")).expect("create output");
        fs::write(output.join("root/file.txt"), b"old").expect("write old");

        let report = run_materialize(
            &raw,
            &output,
            DepthMode::Preserve,
            CollisionPolicy::Overwrite,
            false,
            None,
        );

        assert_eq!(fs::read(output.join("root/file.txt")).unwrap(), b"new");
        assert_eq!(report.replaced_files, vec![output.join("root/file.txt")]);
    }

    #[test]
    fn flatten_zero_places_file_at_destination_root() {
        let mapped = map_relative_path(
            Path::new("root/level-1/file.txt"),
            &DepthMode::Flatten { depth: 0 },
            false,
        )
        .expect("path should map");
        assert_eq!(mapped, PathBuf::from("file.txt"));
    }

    #[test]
    fn unsafe_archive_paths_are_rejected() {
        assert!(super::super::path_safety::safe_archive_path(Path::new("../outside.txt")).is_none());
        assert!(super::super::path_safety::safe_archive_path(Path::new("/absolute.txt")).is_none());
        assert_eq!(super::super::path_safety::safe_archive_path(Path::new("safe/file.txt")), Some(PathBuf::from("safe/file.txt")));
    }
}
