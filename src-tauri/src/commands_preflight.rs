//! 开始前的自检命令：路径合法性、格式支持、目标冲突与磁盘空间估算。
//!
//! 单独成模块，避免 `commands.rs` 无限膨胀。

use crate::archive::{inspect_path, planned_destination};
use crate::models::{PreflightIssue, PreflightJobResult, PreflightRequest, PreflightResult};
use std::fs;
use std::path::PathBuf;

#[tauri::command]
pub fn preflight_jobs(request: PreflightRequest) -> PreflightResult {
    let mut results = Vec::with_capacity(request.jobs.len());
    let mut blocking_issue_count = 0usize;
    let mut warning_count = 0usize;

    for job in request.jobs {
        let archive = PathBuf::from(&job.archive_path);
        let inspected = inspect_path(&archive);
        let archive_size = fs::metadata(&archive).map(|meta| meta.len()).unwrap_or(0);
        let multiplier = request.space_multiplier.clamp(1, 10);
        let estimated_required_bytes = archive_size
            .saturating_mul(multiplier)
            .max(16 * 1024 * 1024);
        let mut issues = Vec::new();
        let output_path = match planned_destination(&job) {
            Ok(path) => Some(path),
            Err(error) => {
                issues.push(PreflightIssue {
                    code: "invalid-output".to_string(),
                    severity: "error",
                    message: error.to_string(),
                });
                None
            }
        };

        if !archive.is_file() {
            issues.push(PreflightIssue {
                code: "missing-archive".to_string(),
                severity: "error",
                message: format!("源文件不存在：{}", archive.display()),
            });
        } else if !inspected.supported {
            issues.push(PreflightIssue {
                code: "unsupported-format".to_string(),
                severity: "error",
                message: format!("不支持的压缩格式：{}", inspected.format),
            });
        }

        if request.check_password
            && job.password.as_deref().unwrap_or_default().is_empty()
            && matches!(inspected.format.as_str(), "ZIP" | "7Z" | "RAR")
        {
            issues.push(PreflightIssue {
                code: "password-not-provided".to_string(),
                severity: "info",
                message: "未输入密码；无密码归档可直接继续，加密归档会在运行时提示。".to_string(),
            });
        }

        let mut available_bytes = None;
        if let Some(destination) = output_path.as_ref() {
            if destination.exists() && !destination.is_dir() {
                issues.push(PreflightIssue {
                    code: "output-is-file".to_string(),
                    severity: "error",
                    message: format!("输出路径不是目录：{}", destination.display()),
                });
            }
            if request.check_conflicts && destination.is_dir() {
                let has_existing = destination
                    .read_dir()
                    .ok()
                    .and_then(|mut entries| entries.next())
                    .is_some();
                if has_existing {
                    let action = match job.collision_policy {
                        crate::models::CollisionPolicy::Overwrite => "同名文件将被替换",
                        crate::models::CollisionPolicy::Rename => "同名文件将自动改名",
                        crate::models::CollisionPolicy::Skip => "同名文件将被跳过",
                    };
                    issues.push(PreflightIssue {
                        code: "existing-output".to_string(),
                        severity: "warning",
                        message: format!("目标目录已有内容，{action}。"),
                    });
                }
            }
            if request.check_disk_space {
                let mut probe = destination.as_path();
                while !probe.exists() {
                    let Some(parent) = probe.parent() else {
                        break;
                    };
                    probe = parent;
                }
                if probe.exists() {
                    match fs2::available_space(probe) {
                        Ok(bytes) => {
                            available_bytes = Some(bytes);
                            let required =
                                estimated_required_bytes.saturating_add(request.minimum_free_bytes);
                            if bytes < required {
                                issues.push(PreflightIssue {
                                    code: "low-disk-space".to_string(),
                                    severity: "error",
                                    message: format!(
                                        "可用空间不足：预计至少需要 {} MB，当前约 {} MB。",
                                        required / 1024 / 1024,
                                        bytes / 1024 / 1024
                                    ),
                                });
                            } else if bytes < required.saturating_mul(2) {
                                issues.push(PreflightIssue {
                                    code: "disk-space-tight".to_string(),
                                    severity: "warning",
                                    message: format!(
                                        "磁盘空间较紧张：当前约 {} MB 可用。",
                                        bytes / 1024 / 1024
                                    ),
                                });
                            }
                        }
                        Err(error) => issues.push(PreflightIssue {
                            code: "disk-space-unavailable".to_string(),
                            severity: "warning",
                            message: format!("无法读取磁盘可用空间：{error}"),
                        }),
                    }
                }
            }
        }

        blocking_issue_count += issues
            .iter()
            .filter(|issue| issue.severity == "error")
            .count();
        warning_count += issues
            .iter()
            .filter(|issue| issue.severity == "warning")
            .count();
        results.push(PreflightJobResult {
            job_id: job.job_id,
            channel_id: job.channel_id,
            archive_path: job.archive_path,
            output_path: output_path.map(|path| path.to_string_lossy().to_string()),
            archive_size,
            estimated_required_bytes,
            available_bytes,
            issues,
        });
    }

    PreflightResult {
        jobs: results,
        blocking_issue_count,
        warning_count,
    }
}
