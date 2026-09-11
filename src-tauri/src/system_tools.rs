use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::models::{ClaudeCliStatus, ClaudeLaunchResult};
use tauri::{AppHandle, Manager};

const CLAUDE_DAT_NAME: &str = "我的Claude项目.dat";
const CLAUDE_DAT_FORMAT: &str = "jieyatai-claude-project";
const CLAUDE_COMMAND: &str = "claude --dangerously-skip-permissions";
const MAX_BACKGROUND_IMAGE_BYTES: u64 = 25 * 1024 * 1024;
const BACKGROUND_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "webp", "bmp", "gif"];

fn existing_directory(value: &str) -> Result<PathBuf, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("Claude 工作目录为空".to_string());
    }
    let directory = PathBuf::from(trimmed);
    if !directory.is_dir() {
        return Err(format!(
            "Claude 工作目录不存在或不是文件夹：{}",
            directory.display()
        ));
    }
    directory
        .canonicalize()
        .map_err(|error| format!("无法读取 Claude 工作目录：{error}"))
}

fn claude_dat_path(directory: &Path) -> PathBuf {
    directory.join(CLAUDE_DAT_NAME)
}

pub fn install_claude_dat(directory: &str, overwrite: bool) -> Result<String, String> {
    let directory = existing_directory(directory)?;
    let target = claude_dat_path(&directory);
    if target.exists() && !overwrite {
        if target.is_file() {
            return Ok(target.to_string_lossy().to_string());
        }
        return Err(format!("DAT 路径不是文件：{}", target.display()));
    }

    let created_at_unix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default();
    let content = serde_json::json!({
        "format": CLAUDE_DAT_FORMAT,
        "schemaVersion": 1,
        "workingDirectory": directory.to_string_lossy(),
        "command": CLAUDE_COMMAND,
        "createdAtUnix": created_at_unix,
        "note": "由解压台生成。启动时固定使用 DAT 所在目录，不执行 DAT 中的自定义命令。"
    });
    let bytes = serde_json::to_vec_pretty(&content)
        .map_err(|error| format!("生成 DAT 内容失败：{error}"))?;
    fs::write(&target, bytes).map_err(|error| format!("写入 Claude DAT 失败：{error}"))?;
    Ok(target.to_string_lossy().to_string())
}

fn resolve_claude_dat(directory: &str) -> Result<(PathBuf, PathBuf), String> {
    let directory = existing_directory(directory)?;
    let dat_path = claude_dat_path(&directory);
    if !dat_path.exists() {
        install_claude_dat(directory.to_string_lossy().as_ref(), true)?;
    }
    if !dat_path.is_file() {
        return Err(format!(
            "Claude DAT 不存在或不是文件：{}",
            dat_path.display()
        ));
    }
    let metadata =
        fs::metadata(&dat_path).map_err(|error| format!("无法读取 Claude DAT：{error}"))?;
    if metadata.len() == 0 {
        return Err(format!("Claude DAT 为空：{}", dat_path.display()));
    }
    Ok((directory, dat_path))
}

pub fn check_claude_cli() -> ClaudeCliStatus {
    crate::claude_cli::check_claude_cli()
}

#[cfg(target_os = "windows")]
pub fn launch_claude_dat(directory: &str) -> Result<ClaudeLaunchResult, String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NEW_CONSOLE: u32 = 0x00000010;
    const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;

    let (directory, dat_path) = resolve_claude_dat(directory)?;
    let cli = crate::claude_cli::resolve_claude_cli()?;

    let child = Command::new("cmd.exe")
        .args(["/D", "/K"])
        .arg(&cli.program)
        .args(&cli.arguments)
        .arg("--dangerously-skip-permissions")
        .current_dir(&directory)
        .env("JIEYATAI_CLAUDE_DAT", &dat_path)
        .creation_flags(CREATE_NEW_CONSOLE | CREATE_NEW_PROCESS_GROUP)
        .spawn()
        .map_err(|error| format!("无法通过 Claude DAT 创建命令窗口：{error}"))?;

    Ok(ClaudeLaunchResult {
        working_directory: directory.to_string_lossy().to_string(),
        dat_path: dat_path.to_string_lossy().to_string(),
        command: CLAUDE_COMMAND.to_string(),
        launcher: format!(
            "我的Claude项目.dat → cmd.exe /D /K（{}：{}）",
            cli.source,
            cli.executable.display()
        ),
        process_id: child.id(),
    })
}

#[cfg(not(target_os = "windows"))]
pub fn launch_claude_dat(_directory: &str) -> Result<ClaudeLaunchResult, String> {
    Err("当前一键启动功能仅在 Windows 构建中启用".to_string())
}

pub fn claude_dat_file_name() -> &'static str {
    CLAUDE_DAT_NAME
}

fn appearance_directory(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法确定应用数据目录：{error}"))?
        .join("appearance");
    fs::create_dir_all(&directory).map_err(|error| format!("无法创建外观资源目录：{error}"))?;
    Ok(directory)
}

pub fn install_background_image(app: &AppHandle, source: &str) -> Result<String, String> {
    let source = PathBuf::from(source.trim());
    if !source.is_file() {
        return Err(format!("背景图片不存在：{}", source.display()));
    }
    let metadata =
        fs::metadata(&source).map_err(|error| format!("无法读取背景图片信息：{error}"))?;
    if metadata.len() > MAX_BACKGROUND_IMAGE_BYTES {
        return Err("背景图片不能超过 25 MB".to_string());
    }
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .ok_or_else(|| "背景图片缺少有效扩展名".to_string())?;
    if !BACKGROUND_EXTENSIONS.contains(&extension.as_str()) {
        return Err(format!("不支持的背景图片格式：.{extension}"));
    }

    let directory = appearance_directory(app)?;
    let target = directory.join(format!("background.{extension}"));
    if source.canonicalize().ok() == target.canonicalize().ok() && target.is_file() {
        return Ok(target.to_string_lossy().to_string());
    }

    if let Ok(entries) = fs::read_dir(&directory) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file()
                && path
                    .file_stem()
                    .and_then(|value| value.to_str())
                    .is_some_and(|value| value == "background")
            {
                let _ = fs::remove_file(path);
            }
        }
    }

    fs::copy(&source, &target).map_err(|error| format!("复制背景图片失败：{error}"))?;
    Ok(target.to_string_lossy().to_string())
}

pub fn clear_background_image(app: &AppHandle) -> Result<(), String> {
    let directory = appearance_directory(app)?;
    let entries =
        fs::read_dir(&directory).map_err(|error| format!("无法读取外观资源目录：{error}"))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file()
            && path
                .file_stem()
                .and_then(|value| value.to_str())
                .is_some_and(|value| value == "background")
        {
            fs::remove_file(path).map_err(|error| format!("删除背景图片失败：{error}"))?;
        }
    }
    Ok(())
}

#[allow(dead_code)]
fn _is_safe_name(path: &Path) -> bool {
    path.file_name().and_then(|value| value.to_str()) == Some(CLAUDE_DAT_NAME)
}
