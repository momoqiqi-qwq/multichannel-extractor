use crate::models::ClaudeCliStatus;

#[cfg(target_os = "windows")]
use std::ffi::OsString;
#[cfg(target_os = "windows")]
use std::fs;
#[cfg(target_os = "windows")]
use std::path::{Path, PathBuf};
#[cfg(target_os = "windows")]
use std::process::Command;

#[cfg(target_os = "windows")]
#[derive(Debug, Clone)]
pub(crate) struct ClaudeCliResolution {
    pub(crate) program: PathBuf,
    pub(crate) arguments: Vec<OsString>,
    pub(crate) executable: PathBuf,
    pub(crate) source: String,
}

#[cfg(target_os = "windows")]
fn command_output(program: &str, args: &[&str]) -> Result<String, String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let output = Command::new(program)
        .args(args)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|error| format!("无法执行 {program}：{error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if output.status.success() {
        Ok(stdout)
    } else {
        Err(if stderr.is_empty() {
            format!("{program} 返回状态 {}", output.status)
        } else {
            stderr
        })
    }
}

#[cfg(target_os = "windows")]
fn existing_path_from_lines(output: &str) -> Option<PathBuf> {
    output
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(PathBuf::from)
        .find(|path| path.is_file())
}

#[cfg(target_os = "windows")]
fn push_unique_path(paths: &mut Vec<PathBuf>, path: PathBuf) {
    let candidate = path.to_string_lossy().to_string();
    if !paths
        .iter()
        .any(|item| item.to_string_lossy().eq_ignore_ascii_case(candidate.as_str()))
    {
        paths.push(path);
    }
}

#[cfg(target_os = "windows")]
fn npm_output(args: &[&str]) -> Option<String> {
    for program in ["npm.cmd", "npm"] {
        let command_line = format!("{program} {}", args.join(" "));
        if let Ok(output) = command_output("cmd.exe", &["/D", "/S", "/C", command_line.as_str()]) {
            if !output.trim().is_empty() {
                return Some(output);
            }
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn node_executable() -> Option<PathBuf> {
    command_output("where.exe", &["node.exe"])
        .ok()
        .and_then(|output| existing_path_from_lines(&output))
        .or_else(|| {
            command_output("where.exe", &["node"])
                .ok()
                .and_then(|output| existing_path_from_lines(&output))
        })
}

#[cfg(target_os = "windows")]
fn direct_resolution(path: PathBuf, source: impl Into<String>) -> ClaudeCliResolution {
    ClaudeCliResolution {
        program: path.clone(),
        arguments: Vec::new(),
        executable: path,
        source: source.into(),
    }
}

#[cfg(target_os = "windows")]
fn package_bin_resolution(package_root: &Path) -> Option<ClaudeCliResolution> {
    let package_json = package_root.join("package.json");
    let bytes = fs::read(package_json).ok()?;
    let value: serde_json::Value = serde_json::from_slice(&bytes).ok()?;
    let relative = value
        .get("bin")
        .and_then(|bin| {
            bin.as_str().map(str::to_string).or_else(|| {
                bin.get("claude")
                    .and_then(serde_json::Value::as_str)
                    .map(str::to_string)
            })
        })?;
    let target = package_root.join(relative);
    if !target.is_file() {
        return None;
    }

    let extension = target
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if matches!(extension.as_str(), "js" | "cjs" | "mjs") {
        let node = node_executable()?;
        return Some(ClaudeCliResolution {
            program: node,
            arguments: vec![target.as_os_str().to_os_string()],
            executable: target,
            source: "npm 官方包 @anthropic-ai/claude-code".to_string(),
        });
    }

    Some(direct_resolution(
        target,
        "npm 官方包 @anthropic-ai/claude-code",
    ))
}

#[cfg(target_os = "windows")]
fn native_package_resolution(package_root: &Path, source: &str) -> Option<ClaudeCliResolution> {
    if !package_root.is_dir() {
        return None;
    }
    for entry in walkdir::WalkDir::new(package_root)
        .max_depth(5)
        .follow_links(false)
        .into_iter()
        .filter_map(Result::ok)
    {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default();
        if name.eq_ignore_ascii_case("claude.exe") || name.eq_ignore_ascii_case("claude.cmd") {
            return Some(direct_resolution(path.to_path_buf(), source));
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn npm_global_locations() -> (Vec<PathBuf>, Vec<PathBuf>) {
    let mut bin_directories = Vec::new();
    let mut node_module_roots = Vec::new();

    if let Some(prefix) = std::env::var_os("NPM_CONFIG_PREFIX") {
        let prefix = PathBuf::from(prefix);
        push_unique_path(&mut bin_directories, prefix.clone());
        push_unique_path(&mut bin_directories, prefix.join("bin"));
        push_unique_path(&mut node_module_roots, prefix.join("node_modules"));
    }
    if let Some(app_data) = std::env::var_os("APPDATA") {
        let prefix = PathBuf::from(app_data).join("npm");
        push_unique_path(&mut bin_directories, prefix.clone());
        push_unique_path(&mut bin_directories, prefix.join("bin"));
        push_unique_path(&mut node_module_roots, prefix.join("node_modules"));
    }
    if let Some(prefix) = npm_output(&["prefix", "-g"]) {
        let prefix = PathBuf::from(prefix.trim());
        push_unique_path(&mut bin_directories, prefix.clone());
        push_unique_path(&mut bin_directories, prefix.join("bin"));
        push_unique_path(&mut node_module_roots, prefix.join("node_modules"));
    }
    if let Some(root) = npm_output(&["root", "-g"]) {
        push_unique_path(&mut node_module_roots, PathBuf::from(root.trim()));
    }

    (bin_directories, node_module_roots)
}

#[cfg(target_os = "windows")]
pub(crate) fn resolve_claude_cli() -> Result<ClaudeCliResolution, String> {
    if let Ok(output) = command_output("where.exe", &["claude"]) {
        if let Some(path) = existing_path_from_lines(&output) {
            return Ok(direct_resolution(path, "系统 PATH"));
        }
    }

    let (bin_directories, node_module_roots) = npm_global_locations();
    for directory in &bin_directories {
        for name in ["claude.cmd", "claude.exe", "claude"] {
            let candidate = directory.join(name);
            if candidate.is_file() {
                return Ok(direct_resolution(candidate, "npm 全局命令目录"));
            }
        }
    }

    for root in &node_module_roots {
        let package_root = root.join("@anthropic-ai").join("claude-code");
        if let Some(resolution) = package_bin_resolution(&package_root) {
            return Ok(resolution);
        }
        if let Some(resolution) = native_package_resolution(
            &package_root,
            "npm 官方包 @anthropic-ai/claude-code",
        ) {
            return Ok(resolution);
        }

        for package_name in ["claude-code-win32-x64", "claude-code-win32-arm64"] {
            let native_root = root.join("@anthropic-ai").join(package_name);
            if let Some(resolution) = native_package_resolution(
                &native_root,
                &format!("npm 官方 Windows 二进制包 @anthropic-ai/{package_name}"),
            ) {
                return Ok(resolution);
            }
        }
    }

    Err(
        "未找到 Claude CLI。已检查系统 PATH、npm 全局命令目录和官方 @anthropic-ai/claude-code 包；可运行 npm install -g @anthropic-ai/claude-code 后重试。"
            .to_string(),
    )
}

#[cfg(target_os = "windows")]
fn resolution_output(resolution: &ClaudeCliResolution, trailing_argument: &str) -> Result<String, String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let extension = resolution
        .program
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    let is_batch = extension.eq_ignore_ascii_case("cmd") || extension.eq_ignore_ascii_case("bat");
    let mut command = if is_batch {
        let mut command = Command::new("cmd.exe");
        command.args(["/D", "/C"]).arg(&resolution.program);
        command
    } else {
        Command::new(&resolution.program)
    };
    let output = command
        .args(&resolution.arguments)
        .arg(trailing_argument)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|error| format!("无法执行 {}：{error}", resolution.executable.display()))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if output.status.success() {
        Ok(stdout)
    } else if stderr.is_empty() {
        Err(format!("Claude CLI 返回状态 {}", output.status))
    } else {
        Err(stderr)
    }
}

#[cfg(target_os = "windows")]
fn claude_version(resolution: &ClaudeCliResolution) -> Option<String> {
    resolution_output(resolution, "--version")
        .ok()
        .and_then(|output| {
            output
                .lines()
                .find(|line| !line.trim().is_empty())
                .map(str::trim)
                .map(str::to_string)
        })
}

#[cfg(target_os = "windows")]
pub(crate) fn check_claude_cli() -> ClaudeCliStatus {
    match resolve_claude_cli() {
        Ok(resolution) => {
            let version = claude_version(&resolution);
            let message = version
                .as_ref()
                .map(|value| format!("Claude CLI 可用：{value}（{}）", resolution.source))
                .unwrap_or_else(|| format!("Claude CLI 已找到（{}），但未读取到版本号", resolution.source));
            ClaudeCliStatus {
                available: true,
                executable: Some(resolution.executable.to_string_lossy().to_string()),
                version,
                source: Some(resolution.source),
                message,
            }
        }
        Err(message) => ClaudeCliStatus {
            available: false,
            executable: None,
            version: None,
            source: None,
            message,
        },
    }
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn check_claude_cli() -> ClaudeCliStatus {
    ClaudeCliStatus {
        available: false,
        executable: None,
        version: None,
        source: None,
        message: "当前一键启动功能仅在 Windows 构建中启用".to_string(),
    }
}
