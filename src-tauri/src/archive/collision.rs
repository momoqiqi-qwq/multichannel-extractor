use super::check_cancel;
use super::error::ArchiveError;
use crate::models::CollisionPolicy;
use crate::task_control::TaskControl;
use std::ffi::OsStr;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use tempfile::{Builder as TempFileBuilder, NamedTempFile};

#[derive(Debug)]
pub(super) struct CopyOutcome {
    pub path: Option<PathBuf>,
    pub replaced: bool,
}

pub(super) fn copy_with_policy(
    source: &Path,
    desired: &Path,
    policy: CollisionPolicy,
    cancel: &TaskControl,
) -> Result<CopyOutcome, ArchiveError> {
    match policy {
        CollisionPolicy::Rename => Ok(CopyOutcome {
            path: Some(copy_unique(source, desired, cancel)?),
            replaced: false,
        }),
        CollisionPolicy::Overwrite => {
            if desired.is_dir() {
                return Err(ArchiveError::InvalidPath(format!(
                    "目标路径是目录，无法覆盖：{}",
                    desired.display()
                )));
            }
            let replaced = desired.exists();
            copy_overwrite_atomic(source, desired, cancel)?;
            Ok(CopyOutcome {
                path: Some(desired.to_path_buf()),
                replaced,
            })
        }
        CollisionPolicy::Skip => {
            if desired.exists() {
                Ok(CopyOutcome {
                    path: None,
                    replaced: false,
                })
            } else {
                copy_overwrite_atomic(source, desired, cancel)?;
                Ok(CopyOutcome {
                    path: Some(desired.to_path_buf()),
                    replaced: false,
                })
            }
        }
    }
}

fn copy_overwrite_atomic(
    source: &Path,
    desired: &Path,
    cancel: &TaskControl,
) -> Result<(), ArchiveError> {
    let parent = desired.parent().ok_or_else(|| {
        ArchiveError::InvalidPath(format!("目标文件缺少父目录：{}", desired.display()))
    })?;
    let mut staged = NamedTempFile::new_in(parent)?;
    {
        let mut source_file = File::open(source)?;
        copy_with_control(&mut source_file, staged.as_file_mut(), cancel)?;
        staged.as_file_mut().flush()?;
        staged.as_file().sync_all()?;
    }

    if !desired.exists() {
        staged
            .persist(desired)
            .map_err(|error| ArchiveError::Io(error.error))?;
        return Ok(());
    }

    let backup = TempFileBuilder::new()
        .prefix(".jieyatai-backup-")
        .tempfile_in(parent)?;
    let backup_path = backup.path().to_path_buf();
    backup.close()?;
    fs::rename(desired, &backup_path)?;

    match staged.persist(desired) {
        Ok(_) => {
            let _ = fs::remove_file(backup_path);
            Ok(())
        }
        Err(error) => {
            let persist_error = error.error;
            let _ = fs::rename(&backup_path, desired);
            Err(ArchiveError::Io(persist_error))
        }
    }
}

fn copy_unique(
    source: &Path,
    desired: &Path,
    cancel: &TaskControl,
) -> Result<PathBuf, ArchiveError> {
    for index in 0u32..10_000 {
        let candidate = if index == 0 {
            desired.to_path_buf()
        } else {
            collision_name(desired, index + 1)
        };
        match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&candidate)
        {
            Ok(mut target) => {
                let copy_result = (|| -> Result<(), ArchiveError> {
                    let mut source_file = File::open(source)?;
                    copy_with_control(&mut source_file, &mut target, cancel)?;
                    target.flush()?;
                    Ok(())
                })();
                if let Err(error) = copy_result {
                    drop(target);
                    let _ = fs::remove_file(&candidate);
                    return Err(error);
                }
                return Ok(candidate);
            }
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(ArchiveError::Io(error)),
        }
    }
    Err(ArchiveError::InvalidPath(format!(
        "无法为重名文件生成唯一名称：{}",
        desired.display()
    )))
}

fn copy_with_control<R: Read, W: Write>(
    reader: &mut R,
    writer: &mut W,
    cancel: &TaskControl,
) -> Result<u64, ArchiveError> {
    let mut buffer = [0u8; 128 * 1024];
    let mut written = 0u64;
    loop {
        check_cancel(cancel)?;
        let count = reader.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        writer.write_all(&buffer[..count])?;
        written = written.saturating_add(count as u64);
    }
    Ok(written)
}

fn collision_name(path: &Path, index: u32) -> PathBuf {
    let parent = path.parent().unwrap_or_else(|| Path::new(""));
    let stem = path
        .file_stem()
        .unwrap_or_else(|| OsStr::new("file"))
        .to_string_lossy();
    let name = match path.extension() {
        Some(extension) => format!("{stem} ({index}).{}", extension.to_string_lossy()),
        None => format!("{stem} ({index})"),
    };
    parent.join(name)
}
