mod collision;
mod error;
mod extractors;
mod kind;
mod layout;
mod path_safety;

use crate::models::{ExtractionJob, InspectedFile};
use crate::task_control::TaskControl;
pub use error::ArchiveError;
use extractors::{extract_7z, extract_rar, extract_single_stream, extract_tar, extract_zip};
use kind::{archive_folder_name, detect_kind, ArchiveKind};
use layout::materialize;
use std::ffi::OsStr;
use std::fs;
use std::path::{Path, PathBuf};
use tempfile::TempDir;

pub fn inspect_path(path: &Path) -> InspectedFile {
    let metadata = fs::metadata(path).ok();
    let kind = detect_kind(path);
    InspectedFile {
        path: path.to_string_lossy().to_string(),
        name: path
            .file_name()
            .unwrap_or_else(|| OsStr::new(""))
            .to_string_lossy()
            .to_string(),
        size: metadata.as_ref().map(|item| item.len()).unwrap_or(0),
        format: kind
            .map(ArchiveKind::label)
            .unwrap_or("UNKNOWN")
            .to_string(),
        supported: metadata.map(|item| item.is_file()).unwrap_or(false) && kind.is_some(),
    }
}

#[derive(Debug, Clone)]
pub struct ExtractionReport {
    pub output_path: PathBuf,
    pub written_files: Vec<PathBuf>,
    pub replaced_files: Vec<PathBuf>,
    pub created_directories: Vec<PathBuf>,
    pub output_root_created: bool,
}

pub fn extract_job<F>(
    job: &ExtractionJob,
    cancel: &TaskControl,
    mut progress: F,
) -> Result<ExtractionReport, ArchiveError>
where
    F: FnMut(u8, &'static str, String),
{
    check_cancel(cancel)?;
    let archive_path = PathBuf::from(&job.archive_path);
    if !archive_path.is_file() {
        return Err(ArchiveError::InvalidPath(format!(
            "源文件不存在：{}",
            archive_path.display()
        )));
    }

    let kind = detect_kind(&archive_path).ok_or_else(|| {
        ArchiveError::Unsupported(
            archive_path
                .extension()
                .unwrap_or_else(|| OsStr::new("未知"))
                .to_string_lossy()
                .to_string(),
        )
    })?;

    let archive_wrapper_name = job
        .create_archive_subfolder
        .then(|| archive_folder_name(&archive_path))
        .transpose()?;
    let destination = planned_destination(job)?;
    let output_root_created = !destination.exists();

    let temp = TempDir::new()?;
    let raw_dir = temp.path().join("raw");
    fs::create_dir_all(&raw_dir)?;

    progress(2, "extracting", format!("准备解压 {}", kind.label()));
    match kind {
        ArchiveKind::Zip => extract_zip(
            &archive_path,
            &raw_dir,
            job.password.as_deref(),
            cancel,
            &mut progress,
        )?,
        ArchiveKind::SevenZip => extract_7z(
            &archive_path,
            &raw_dir,
            job.password.as_deref(),
            cancel,
            &mut progress,
        )?,
        ArchiveKind::Rar => extract_rar(
            &archive_path,
            &raw_dir,
            job.password.as_deref(),
            cancel,
            &mut progress,
        )?,
        ArchiveKind::Tar | ArchiveKind::TarGz | ArchiveKind::TarBz2 | ArchiveKind::TarXz => {
            extract_tar(&archive_path, &raw_dir, kind, cancel, &mut progress)?
        }
        ArchiveKind::Gz | ArchiveKind::Bz2 | ArchiveKind::Xz => {
            extract_single_stream(&archive_path, &raw_dir, kind, cancel, &mut progress)?
        }
    }

    check_cancel(cancel)?;
    fs::create_dir_all(&destination)?;
    progress(72, "arranging", "正在应用目录层级规则".to_string());
    let materialized = materialize(
        &raw_dir,
        &destination,
        &job.depth_mode,
        job.collision_policy,
        job.skip_junk_files,
        job.keep_empty_directories,
        job.deduplicate_archive_root,
        archive_wrapper_name.as_deref(),
        cancel,
        &mut progress,
    )?;
    progress(100, "finished", "解压完成".to_string());
    Ok(ExtractionReport {
        output_path: destination,
        written_files: materialized.written_files,
        replaced_files: materialized.replaced_files,
        created_directories: materialized.created_directories,
        output_root_created,
    })
}

pub fn planned_destination(job: &ExtractionJob) -> Result<PathBuf, ArchiveError> {
    let archive_path = PathBuf::from(&job.archive_path);
    resolve_destination(job, &archive_path)
}

fn resolve_destination(job: &ExtractionJob, archive_path: &Path) -> Result<PathBuf, ArchiveError> {
    let base = if job.use_archive_directory {
        archive_path
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| ArchiveError::InvalidPath("无法确定压缩包所在目录".to_string()))?
    } else {
        if job.destination.trim().is_empty() {
            return Err(ArchiveError::InvalidPath(
                "尚未设置解压目标目录".to_string(),
            ));
        }
        PathBuf::from(job.destination.trim())
    };

    if job.create_archive_subfolder {
        Ok(base.join(archive_folder_name(archive_path)?))
    } else {
        Ok(base)
    }
}

pub(super) fn check_cancel(cancel: &TaskControl) -> Result<(), ArchiveError> {
    if cancel.checkpoint() {
        Err(ArchiveError::Cancelled)
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    use crate::models::{CollisionPolicy, DepthMode, ExtractionJob};
    use std::fs::File;
    use std::io::Cursor;

    fn test_job(archive: &Path, destination: &Path, depth_mode: DepthMode) -> ExtractionJob {
        ExtractionJob {
            job_id: "integration-job".to_string(),
            channel_id: "integration-channel".to_string(),
            archive_path: archive.to_string_lossy().to_string(),
            destination: destination.to_string_lossy().to_string(),
            use_archive_directory: false,
            create_archive_subfolder: false,
            deduplicate_archive_root: true,
            collision_policy: CollisionPolicy::Overwrite,
            depth_mode,
            password: None,
            open_after: false,
            skip_junk_files: true,
            keep_empty_directories: true,
        }
    }

    fn create_tar(path: &Path, entries: &[(&str, &[u8])]) {
        let file = File::create(path).expect("create tar");
        let mut builder = tar::Builder::new(file);
        for (name, content) in entries {
            let mut header = tar::Header::new_gnu();
            header.set_size(content.len() as u64);
            header.set_mode(0o644);
            header.set_cksum();
            builder
                .append_data(&mut header, *name, Cursor::new(*content))
                .expect("append tar entry");
        }
        builder.finish().expect("finish tar");
    }

    #[test]
    fn tar_pipeline_applies_skip_outer() {
        let temp = TempDir::new().expect("temp dir");
        let archive = temp.path().join("fixture.tar");
        let output = temp.path().join("output");
        create_tar(
            &archive,
            &[
                ("package/assets/icon.txt", b"icon"),
                ("package/readme.txt", b"readme"),
            ],
        );

        let cancel = TaskControl::default();
        let report = extract_job(
            &test_job(&archive, &output, DepthMode::SkipOuter),
            &cancel,
            |_, _, _| {},
        )
        .expect("tar extraction succeeds");

        assert_eq!(fs::read(output.join("assets/icon.txt")).unwrap(), b"icon");
        assert_eq!(fs::read(output.join("readme.txt")).unwrap(), b"readme");
        assert_eq!(report.written_files.len(), 2);
    }

    #[test]
    fn corrupt_archive_does_not_create_destination() {
        let temp = TempDir::new().expect("temp dir");
        let archive = temp.path().join("broken.tar");
        let output = temp.path().join("must-not-exist");
        fs::write(&archive, vec![1u8; 512]).expect("write corrupt fixture");

        let cancel = TaskControl::default();
        let result = extract_job(
            &test_job(&archive, &output, DepthMode::Preserve),
            &cancel,
            |_, _, _| {},
        );

        assert!(result.is_err());
        assert!(
            !output.exists(),
            "failed extraction must not leave an output directory"
        );
    }
}
