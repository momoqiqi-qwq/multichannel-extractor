use super::check_cancel;
use super::error::ArchiveError;
use super::kind::ArchiveKind;
use super::path_safety::safe_archive_path;
use bzip2::read::BzDecoder;
use flate2::read::GzDecoder;
use std::ffi::{OsStr, OsString};
use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use crate::task_control::TaskControl;
use tar::Archive;
use xz2::read::XzDecoder;
use zip::result::ZipError;
use zip::{ZipArchive, ZipReadOptions};

pub(super) fn extract_zip<F>(
    archive_path: &Path,
    output: &Path,
    password: Option<&str>,
    cancel: &TaskControl,
    progress: &mut F,
) -> Result<(), ArchiveError>
where
    F: FnMut(u8, &'static str, String),
{
    let file = File::open(archive_path)?;
    let mut archive = ZipArchive::new(file).map_err(map_zip_error)?;
    let total = archive.len().max(1);
    let password_bytes = password.filter(|value| !value.is_empty()).map(str::as_bytes);

    for index in 0..archive.len() {
        check_cancel(cancel)?;
        let options = ZipReadOptions::new().password(password_bytes);
        let mut entry = archive
            .by_index_with_options(index, options)
            .map_err(map_zip_error)?;

        let Some(relative) = entry.enclosed_name() else {
            continue;
        };
        if is_zip_symlink(entry.unix_mode()) {
            continue;
        }
        let target = output.join(relative);
        if entry.is_dir() {
            fs::create_dir_all(&target)?;
        } else {
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)?;
            }
            let mut file = File::create(&target)?;
            copy_with_control(&mut entry, &mut file, cancel)?;
            file.flush()?;
        }
        let percent = 5 + (((index + 1) * 62 / total) as u8);
        progress(percent.min(67), "extracting", format!("正在读取 ZIP 条目 {}/{}", index + 1, total));
    }
    Ok(())
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

fn map_zip_error(error: ZipError) -> ArchiveError {
    match error {
        ZipError::InvalidPassword => ArchiveError::InvalidPassword,
        ZipError::UnsupportedArchive(message) if message == ZipError::PASSWORD_REQUIRED => ArchiveError::PasswordRequired,
        other => ArchiveError::InvalidArchive(other.to_string()),
    }
}

fn is_zip_symlink(mode: Option<u32>) -> bool {
    mode.map(|value| value & 0o170000 == 0o120000).unwrap_or(false)
}

pub(super) fn extract_tar<F>(
    archive_path: &Path,
    output: &Path,
    kind: ArchiveKind,
    cancel: &TaskControl,
    progress: &mut F,
) -> Result<(), ArchiveError>
where
    F: FnMut(u8, &'static str, String),
{
    let file = File::open(archive_path)?;
    let reader: Box<dyn Read> = match kind {
        ArchiveKind::Tar => Box::new(file),
        ArchiveKind::TarGz => Box::new(GzDecoder::new(file)),
        ArchiveKind::TarBz2 => Box::new(BzDecoder::new(file)),
        ArchiveKind::TarXz => Box::new(XzDecoder::new(file)),
        _ => return Err(ArchiveError::Unsupported(kind.label().to_string())),
    };
    let mut archive = Archive::new(reader);
    let mut count = 0usize;

    for item in archive.entries()? {
        check_cancel(cancel)?;
        let mut entry = item?;
        let entry_type = entry.header().entry_type();
        if !(entry_type.is_file() || entry_type.is_dir()) {
            continue;
        }
        let relative = safe_archive_path(&entry.path()?.into_owned())
            .ok_or_else(|| ArchiveError::InvalidArchive("归档包含不安全路径".to_string()))?;
        let target = output.join(relative);
        if entry_type.is_dir() {
            fs::create_dir_all(&target)?;
        } else {
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)?;
            }
            let mut file = File::create(&target)?;
            copy_with_control(&mut entry, &mut file, cancel)?;
            file.flush()?;
        }
        count += 1;
        let percent = (8 + (count.min(120) * 59 / 120)) as u8;
        progress(
            percent.min(67),
            "extracting",
            format!("正在读取 TAR 条目 {count}"),
        );
    }
    Ok(())
}

pub(super) fn extract_single_stream<F>(
    archive_path: &Path,
    output: &Path,
    kind: ArchiveKind,
    cancel: &TaskControl,
    progress: &mut F,
) -> Result<(), ArchiveError>
where
    F: FnMut(u8, &'static str, String),
{
    check_cancel(cancel)?;
    let file = File::open(archive_path)?;
    let mut reader: Box<dyn Read> = match kind {
        ArchiveKind::Gz => Box::new(GzDecoder::new(file)),
        ArchiveKind::Bz2 => Box::new(BzDecoder::new(file)),
        ArchiveKind::Xz => Box::new(XzDecoder::new(file)),
        _ => return Err(ArchiveError::Unsupported(kind.label().to_string())),
    };
    let output_name = stripped_stream_name(archive_path, kind)?;
    let target = output.join(output_name);
    let mut target_file = File::create(target)?;
    let mut buffer = [0u8; 1024 * 128];
    let mut chunks = 0usize;
    loop {
        check_cancel(cancel)?;
        let read = reader.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        target_file.write_all(&buffer[..read])?;
        chunks += 1;
        let percent = (10 + chunks.min(57)) as u8;
        progress(
            percent.min(67),
            "extracting",
            format!("正在解压 {} 数据流", kind.label()),
        );
    }
    target_file.flush()?;
    Ok(())
}

fn stripped_stream_name(path: &Path, kind: ArchiveKind) -> Result<OsString, ArchiveError> {
    let name = path
        .file_name()
        .ok_or_else(|| ArchiveError::InvalidPath("压缩文件缺少文件名".to_string()))?
        .to_string_lossy();
    let suffix = match kind {
        ArchiveKind::Gz => ".gz",
        ArchiveKind::Bz2 => ".bz2",
        ArchiveKind::Xz => ".xz",
        _ => "",
    };
    let stripped = name.strip_suffix(suffix).unwrap_or(&name);
    let fallback = if stripped.is_empty() { "decompressed" } else { stripped };
    Ok(OsString::from(fallback))
}

pub(super) fn extract_7z<F>(
    archive_path: &Path,
    output: &Path,
    password: Option<&str>,
    cancel: &TaskControl,
    progress: &mut F,
) -> Result<(), ArchiveError>
where
    F: FnMut(u8, &'static str, String),
{
    check_cancel(cancel)?;
    progress(12, "extracting", "正在调用 sevenz-rust".to_string());
    let result = if let Some(password) = password.filter(|value| !value.is_empty()) {
        sevenz_rust::decompress_file_with_password(archive_path, output, password.into())
    } else {
        sevenz_rust::decompress_file(archive_path, output)
    };
    result.map_err(|error| {
        let message = error.to_string();
        let lower = message.to_ascii_lowercase();
        if lower.contains("password") {
            if password.filter(|value| !value.is_empty()).is_some() {
                ArchiveError::InvalidPassword
            } else {
                ArchiveError::PasswordRequired
            }
        } else {
            ArchiveError::InvalidArchive(message)
        }
    })?;
    check_cancel(cancel)?;
    progress(67, "extracting", "7Z 内容已解包".to_string());
    Ok(())
}

pub(super) fn extract_rar<F>(
    archive_path: &Path,
    output: &Path,
    password: Option<&str>,
    cancel: &TaskControl,
    progress: &mut F,
) -> Result<(), ArchiveError>
where
    F: FnMut(u8, &'static str, String),
{
    check_cancel(cancel)?;
    progress(12, "extracting", "正在查找 unrar / 7z".to_string());

    let mut attempts = Vec::new();
    match run_unrar(archive_path, output, password) {
        Ok(()) => {
            check_cancel(cancel)?;
            progress(67, "extracting", "RAR 内容已由 unrar 解包".to_string());
            return Ok(());
        }
        Err(ToolAttempt::NotFound) => {}
        Err(ToolAttempt::Failed(message)) => attempts.push(format!("unrar: {message}")),
    }

    for program in ["7z", "7zz"] {
        match run_7z_cli(program, archive_path, output, password) {
            Ok(()) => {
                check_cancel(cancel)?;
                progress(67, "extracting", format!("RAR 内容已由 {program} 解包"));
                return Ok(());
            }
            Err(ToolAttempt::NotFound) => continue,
            Err(ToolAttempt::Failed(message)) => attempts.push(format!("{program}: {message}")),
        }
    }

    let combined = attempts.join("\n\n");
    let lower = combined.to_ascii_lowercase();
    if lower.contains("wrong password") || lower.contains("password") {
        return Err(if password.filter(|value| !value.is_empty()).is_some() {
            ArchiveError::InvalidPassword
        } else {
            ArchiveError::PasswordRequired
        });
    }
    if !combined.is_empty() {
        return Err(ArchiveError::ExternalTool(combined));
    }
    Err(ArchiveError::ExternalTool(
        "系统中未找到 unrar、7z 或 7zz。请安装其中一个命令行工具并加入 PATH。".to_string(),
    ))
}

enum ToolAttempt {
    NotFound,
    Failed(String),
}

fn run_unrar(
    archive_path: &Path,
    output: &Path,
    password: Option<&str>,
) -> Result<(), ToolAttempt> {
    let mut command = Command::new("unrar");
    command.arg("x").arg("-o+").arg("-idq");
    if let Some(password) = password.filter(|value| !value.is_empty()) {
        command.arg(format!("-p{password}"));
    } else {
        command.arg("-p-");
    }
    command
        .arg(archive_path)
        .arg(output)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    run_external(command)
}

fn run_7z_cli(
    program: &str,
    archive_path: &Path,
    output: &Path,
    password: Option<&str>,
) -> Result<(), ToolAttempt> {
    let mut command = Command::new(program);
    command
        .arg("x")
        .arg("-y")
        .arg(format!("-o{}", output.display()));
    if let Some(password) = password.filter(|value| !value.is_empty()) {
        command.arg(format!("-p{password}"));
    }
    command
        .arg(archive_path)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    run_external(command)
}

fn run_external(mut command: Command) -> Result<(), ToolAttempt> {
    match command.output() {
        Ok(output) if output.status.success() => Ok(()),
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(ToolAttempt::Failed(format!(
                "退出码 {:?}\n{}\n{}",
                output.status.code(),
                stdout.trim(),
                stderr.trim()
            )))
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => Err(ToolAttempt::NotFound),
        Err(error) => Err(ToolAttempt::Failed(error.to_string())),
    }
}

