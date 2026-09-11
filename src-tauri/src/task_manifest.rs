use crate::archive::ExtractionReport;
use crate::models::{DeleteExtractionResult, ExtractionJob};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const MANIFEST_SCHEMA_VERSION: u8 = 1;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExtractionManifest {
    schema_version: u8,
    job_id: String,
    archive_path: String,
    output_path: String,
    written_files: Vec<String>,
    replaced_files: Vec<String>,
    created_directories: Vec<String>,
    output_root_created: bool,
    created_at_unix_ms: u128,
}

fn manifests_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法确定应用数据目录：{error}"))?
        .join("extraction-manifests");
    fs::create_dir_all(&directory).map_err(|error| format!("无法创建任务清单目录：{error}"))?;
    Ok(directory)
}

pub fn write_manifest(
    app: &AppHandle,
    job: &ExtractionJob,
    report: &ExtractionReport,
) -> Result<PathBuf, String> {
    let directory = manifests_dir(app)?;
    let path = directory.join(format!("{}.json", job.job_id));
    let manifest = ExtractionManifest {
        schema_version: MANIFEST_SCHEMA_VERSION,
        job_id: job.job_id.clone(),
        archive_path: job.archive_path.clone(),
        output_path: report.output_path.to_string_lossy().to_string(),
        written_files: report
            .written_files
            .iter()
            .map(|path| path.to_string_lossy().to_string())
            .collect(),
        replaced_files: report
            .replaced_files
            .iter()
            .map(|path| path.to_string_lossy().to_string())
            .collect(),
        created_directories: report
            .created_directories
            .iter()
            .map(|path| path.to_string_lossy().to_string())
            .collect(),
        output_root_created: report.output_root_created,
        created_at_unix_ms: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or_default(),
    };
    let content = serde_json::to_vec_pretty(&manifest)
        .map_err(|error| format!("无法序列化任务清单：{error}"))?;
    fs::write(&path, content).map_err(|error| format!("无法写入任务清单：{error}"))?;
    Ok(path)
}

pub fn delete_from_manifest(
    app: &AppHandle,
    manifest_path: &str,
    delete_replaced: bool,
) -> Result<DeleteExtractionResult, String> {
    let allowed_root = manifests_dir(app)?
        .canonicalize()
        .map_err(|error| format!("无法校验任务清单目录：{error}"))?;
    let requested = PathBuf::from(manifest_path);
    let canonical_manifest = requested
        .canonicalize()
        .map_err(|error| format!("任务清单不存在或不可读取：{error}"))?;
    if !canonical_manifest.starts_with(&allowed_root) {
        return Err("拒绝读取应用数据目录之外的任务清单".to_string());
    }

    let content =
        fs::read(&canonical_manifest).map_err(|error| format!("无法读取任务清单：{error}"))?;
    let manifest: ExtractionManifest =
        serde_json::from_slice(&content).map_err(|error| format!("任务清单格式无效：{error}"))?;
    if manifest.schema_version != MANIFEST_SCHEMA_VERSION {
        return Err(format!("不支持的任务清单版本：{}", manifest.schema_version));
    }

    let output_root = PathBuf::from(&manifest.output_path);
    if !output_root.exists() {
        let _ = fs::remove_file(&canonical_manifest);
        return Ok(DeleteExtractionResult {
            deleted_files: 0,
            skipped_replaced_files: 0,
            deleted_directories: 0,
        });
    }
    let root_metadata =
        fs::symlink_metadata(&output_root).map_err(|error| format!("无法检查输出目录：{error}"))?;
    if root_metadata.file_type().is_symlink() || !root_metadata.is_dir() {
        return Err(format!(
            "输出根目录不是可信文件夹：{}",
            output_root.display()
        ));
    }
    let canonical_output_root = output_root
        .canonicalize()
        .map_err(|error| format!("无法校验输出目录：{error}"))?;
    let replaced: HashSet<PathBuf> = manifest.replaced_files.iter().map(PathBuf::from).collect();
    let mut deleted_files = 0usize;
    let mut skipped_replaced_files = 0usize;

    for value in &manifest.written_files {
        let path = PathBuf::from(value);
        validate_manifest_target(&output_root, &canonical_output_root, &path)?;
        if replaced.contains(&path) && !delete_replaced {
            skipped_replaced_files += 1;
            continue;
        }
        if path.is_file() || path.is_symlink() {
            fs::remove_file(&path)
                .map_err(|error| format!("删除 {} 失败：{error}", path.display()))?;
            deleted_files += 1;
        }
    }

    let mut directories: Vec<PathBuf> = manifest
        .created_directories
        .iter()
        .map(PathBuf::from)
        .collect();
    if manifest.output_root_created {
        directories.push(output_root.clone());
    }
    directories.sort_by_key(|path| std::cmp::Reverse(path.components().count()));
    directories.dedup();
    let mut deleted_directories = 0usize;
    for directory in directories {
        if !directory.starts_with(&output_root) && directory != output_root {
            continue;
        }
        if directory.exists() {
            validate_manifest_target(&output_root, &canonical_output_root, &directory)?;
        }
        if directory.is_dir() && fs::remove_dir(&directory).is_ok() {
            deleted_directories += 1;
        }
    }

    let _ = fs::remove_file(&canonical_manifest);
    Ok(DeleteExtractionResult {
        deleted_files,
        skipped_replaced_files,
        deleted_directories,
    })
}

fn validate_manifest_target(
    output_root: &Path,
    canonical_output_root: &Path,
    target: &Path,
) -> Result<(), String> {
    if !target.starts_with(output_root) {
        return Err(format!(
            "任务清单包含输出目录之外的路径：{}",
            target.display()
        ));
    }
    if target == output_root {
        return Ok(());
    }
    if !target.exists() && !target.is_symlink() {
        return Ok(());
    }
    let parent = target.parent().unwrap_or(output_root);
    let canonical_parent = parent
        .canonicalize()
        .map_err(|error| format!("无法校验 {} 的父目录：{error}", target.display()))?;
    if !canonical_parent.starts_with(canonical_output_root) {
        return Err(format!(
            "拒绝删除经符号链接指向输出目录之外的路径：{}",
            target.display()
        ));
    }
    if target.is_symlink() {
        return Ok(());
    }
    let canonical_target = target
        .canonicalize()
        .map_err(|error| format!("无法校验待删除路径 {}：{error}", target.display()))?;
    if !canonical_target.starts_with(canonical_output_root) {
        return Err(format!("拒绝删除输出目录之外的路径：{}", target.display()));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_paths_are_expected_to_stay_under_output_root() {
        let output = Path::new("C:/work/output");
        assert!(Path::new("C:/work/output/file.txt").starts_with(output));
        assert!(!Path::new("C:/work/other/file.txt").starts_with(output));
    }
}
