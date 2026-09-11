use crate::archive::{extract_job, inspect_path, planned_destination, ArchiveError};
use crate::models::{
    ArchiveDirectoryScanRequest, ArchiveDirectoryScanResult, BatchFinishedEvent, ClaudeCliStatus,
    ClaudeLaunchResult, DeleteExtractionResult, ExtractionJob, InspectedFile, JobFinishedEvent,
    PreflightIssue, PreflightJobResult, PreflightRequest, PreflightResult, ProgressEvent,
    StartBatchRequest,
};
use crate::task_control::TaskControl;
use crate::task_manifest::{delete_from_manifest, write_manifest};
use crate::directory_scan;
use crate::system_tools;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, Weak};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_opener::OpenerExt;
use tokio::sync::{OwnedSemaphorePermit, Semaphore};
use uuid::Uuid;

#[derive(Clone, Default)]
pub struct TaskRegistry {
    tasks: Arc<Mutex<HashMap<String, Arc<TaskControl>>>>,
    destination_locks: Arc<Mutex<HashMap<String, Weak<Semaphore>>>>,
}

impl TaskRegistry {
    fn insert(&self, job_id: String, control: Arc<TaskControl>) {
        if let Ok(mut tasks) = self.tasks.lock() {
            tasks.insert(job_id, control);
        }
    }

    fn remove(&self, job_id: &str) {
        if let Ok(mut tasks) = self.tasks.lock() {
            tasks.remove(job_id);
        }
    }

    fn cancel(&self, job_id: &str) -> bool {
        let Ok(tasks) = self.tasks.lock() else {
            return false;
        };
        let Some(control) = tasks.get(job_id) else {
            return false;
        };
        control.cancel();
        true
    }

    fn pause(&self, job_id: &str) -> bool {
        let Ok(tasks) = self.tasks.lock() else { return false; };
        let Some(control) = tasks.get(job_id) else { return false; };
        control.pause();
        true
    }

    fn resume(&self, job_id: &str) -> bool {
        let Ok(tasks) = self.tasks.lock() else { return false; };
        let Some(control) = tasks.get(job_id) else { return false; };
        control.resume();
        true
    }

    fn destination_lock(&self, path: &Path) -> Arc<Semaphore> {
        let mut key = path.to_string_lossy().to_string();
        if cfg!(target_os = "windows") {
            key = key.to_lowercase();
        }
        let Ok(mut locks) = self.destination_locks.lock() else {
            return Arc::new(Semaphore::new(1));
        };
        locks.retain(|_, lock| lock.strong_count() > 0);
        if let Some(lock) = locks.get(&key).and_then(Weak::upgrade) {
            return lock;
        }
        let lock = Arc::new(Semaphore::new(1));
        locks.insert(key, Arc::downgrade(&lock));
        lock
    }
}

#[derive(Debug, Clone, Copy)]
enum JobOutcome {
    Succeeded,
    Failed,
    Cancelled,
}

#[tauri::command]
pub fn inspect_files(paths: Vec<String>) -> Vec<InspectedFile> {
    paths
        .into_iter()
        .map(PathBuf::from)
        .map(|path| inspect_path(&path))
        .collect()
}

#[tauri::command]
pub fn scan_archive_directory(
    request: ArchiveDirectoryScanRequest,
) -> Result<ArchiveDirectoryScanResult, String> {
    directory_scan::scan_archive_directory(request)
}

#[tauri::command]
pub fn startup_archive_paths() -> Vec<String> {
    std::env::args_os()
        .skip(1)
        .map(PathBuf::from)
        .filter(|path| path.is_file())
        .map(|path| path.to_string_lossy().to_string())
        .collect()
}

#[tauri::command]
pub fn get_download_directory(app: AppHandle) -> Result<String, String> {
    app.path()
        .download_dir()
        .map(|path| path.to_string_lossy().to_string())
        .map_err(|error| format!("无法确定系统下载目录：{error}"))
}

#[tauri::command]
pub async fn start_batch(
    app: AppHandle,
    registry: State<'_, TaskRegistry>,
    request: StartBatchRequest,
) -> Result<String, String> {
    if request.jobs.is_empty() {
        return Err("任务列表为空".to_string());
    }

    let batch_id = Uuid::new_v4().to_string();
    let batch_id_for_task = batch_id.clone();
    let total = request.jobs.len();
    let max_concurrency = request.max_concurrency.clamp(1, 8);
    let registry = registry.inner().clone();

    tauri::async_runtime::spawn(async move {
        let semaphore = Arc::new(Semaphore::new(max_concurrency));
        let mut handles = Vec::with_capacity(total);

        for job in request.jobs {
            let app = app.clone();
            let semaphore = semaphore.clone();
            let registry = registry.clone();
            let control = Arc::new(TaskControl::default());
            registry.insert(job.job_id.clone(), control.clone());

            let handle = tauri::async_runtime::spawn(async move {
                emit_progress(&app, &job, 0, "queued", "正在规划输出目录");
                let destination = match planned_destination(&job) {
                    Ok(path) => path,
                    Err(error) => {
                        emit_finished(&app, &job, false, None, Some(error.to_string()), 0, None, 0, 0);
                        registry.remove(&job.job_id);
                        return JobOutcome::Failed;
                    }
                };

                let destination_lock = registry.destination_lock(&destination);
                let destination_permit = match acquire_with_control(
                    &app,
                    &job,
                    &control,
                    destination_lock,
                    "等待目标目录写入锁",
                )
                .await
                {
                    Ok(Some(permit)) => permit,
                    Ok(None) => {
                        emit_finished(&app, &job, false, None, Some("任务已取消".to_string()), 0, None, 0, 0);
                        registry.remove(&job.job_id);
                        return JobOutcome::Cancelled;
                    }
                    Err(error) => {
                        emit_finished(&app, &job, false, None, Some(error), 0, None, 0, 0);
                        registry.remove(&job.job_id);
                        return JobOutcome::Failed;
                    }
                };

                let permit = match acquire_with_control(
                    &app,
                    &job,
                    &control,
                    semaphore,
                    "等待并发空位",
                )
                .await
                {
                    Ok(Some(permit)) => permit,
                    Ok(None) => {
                        drop(destination_permit);
                        emit_finished(&app, &job, false, None, Some("任务已取消".to_string()), 0, None, 0, 0);
                        registry.remove(&job.job_id);
                        return JobOutcome::Cancelled;
                    }
                    Err(error) => {
                        drop(destination_permit);
                        emit_finished(&app, &job, false, None, Some(error), 0, None, 0, 0);
                        registry.remove(&job.job_id);
                        return JobOutcome::Failed;
                    }
                };

                emit_progress(&app, &job, 1, "extracting", "任务已开始");
                let started = Instant::now();
                let job_for_worker = job.clone();
                let control_for_worker = control.clone();
                let app_for_worker = app.clone();

                let worker_result = tauri::async_runtime::spawn_blocking(move || {
                    extract_job(
                        &job_for_worker,
                        &control_for_worker,
                        |progress, phase, message| {
                            let payload = ProgressEvent {
                                job_id: job_for_worker.job_id.clone(),
                                channel_id: job_for_worker.channel_id.clone(),
                                archive_path: job_for_worker.archive_path.clone(),
                                progress,
                                phase,
                                message,
                            };
                            let _ = app_for_worker.emit("extract-progress", payload);
                        },
                    )
                })
                .await;

                drop(destination_permit);
                drop(permit);
                let duration_ms = started.elapsed().as_millis();
                let outcome = match worker_result {
                    Ok(Ok(report)) => {
                        let output_string = report.output_path.to_string_lossy().to_string();
                        let manifest_path = match write_manifest(&app, &job, &report) {
                            Ok(path) => Some(path.to_string_lossy().to_string()),
                            Err(error) => {
                                eprintln!("failed to write extraction manifest for {}: {error}", job.job_id);
                                None
                            }
                        };
                        if job.open_after {
                            let _ = app.opener().open_path(&output_string, None::<&str>);
                        }
                        emit_finished(
                            &app,
                            &job,
                            true,
                            Some(output_string),
                            None,
                            duration_ms,
                            manifest_path,
                            report.written_files.len(),
                            report.replaced_files.len(),
                        );
                        JobOutcome::Succeeded
                    }
                    Ok(Err(ArchiveError::Cancelled)) => {
                        emit_finished(
                            &app,
                            &job,
                            false,
                            None,
                            Some("任务已取消".to_string()),
                            duration_ms,
                            None,
                            0,
                            0,
                        );
                        JobOutcome::Cancelled
                    }
                    Ok(Err(error)) => {
                        emit_finished(
                            &app,
                            &job,
                            false,
                            None,
                            Some(error.to_string()),
                            duration_ms,
                            None,
                            0,
                            0,
                        );
                        JobOutcome::Failed
                    }
                    Err(error) => {
                        emit_finished(
                            &app,
                            &job,
                            false,
                            None,
                            Some(format!("后台任务异常：{error}")),
                            duration_ms,
                            None,
                            0,
                            0,
                        );
                        JobOutcome::Failed
                    }
                };

                registry.remove(&job.job_id);
                outcome
            });
            handles.push(handle);
        }

        let mut succeeded = 0usize;
        let mut failed = 0usize;
        let mut cancelled = 0usize;
        for handle in handles {
            match handle.await {
                Ok(JobOutcome::Succeeded) => succeeded += 1,
                Ok(JobOutcome::Cancelled) => cancelled += 1,
                Ok(JobOutcome::Failed) | Err(_) => failed += 1,
            }
        }

        let _ = app.emit(
            "batch-finished",
            BatchFinishedEvent {
                batch_id: batch_id_for_task,
                total,
                succeeded,
                failed,
                cancelled,
            },
        );
    });

    Ok(batch_id)
}

#[tauri::command]
pub fn cancel_job(registry: State<'_, TaskRegistry>, job_id: String) -> bool {
    registry.cancel(&job_id)
}

#[tauri::command]
pub fn pause_job(registry: State<'_, TaskRegistry>, job_id: String) -> bool {
    registry.pause(&job_id)
}

#[tauri::command]
pub fn resume_job(registry: State<'_, TaskRegistry>, job_id: String) -> bool {
    registry.resume(&job_id)
}

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
        let estimated_required_bytes = archive_size.saturating_mul(multiplier).max(16 * 1024 * 1024);
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
                    let Some(parent) = probe.parent() else { break; };
                    probe = parent;
                }
                if probe.exists() {
                    match fs2::available_space(probe) {
                        Ok(bytes) => {
                            available_bytes = Some(bytes);
                            let required = estimated_required_bytes.saturating_add(request.minimum_free_bytes);
                            if bytes < required {
                                issues.push(PreflightIssue {
                                    code: "low-disk-space".to_string(),
                                    severity: "error",
                                    message: format!("可用空间不足：预计至少需要 {} MB，当前约 {} MB。", required / 1024 / 1024, bytes / 1024 / 1024),
                                });
                            } else if bytes < required.saturating_mul(2) {
                                issues.push(PreflightIssue {
                                    code: "disk-space-tight".to_string(),
                                    severity: "warning",
                                    message: format!("磁盘空间较紧张：当前约 {} MB 可用。", bytes / 1024 / 1024),
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

        blocking_issue_count += issues.iter().filter(|issue| issue.severity == "error").count();
        warning_count += issues.iter().filter(|issue| issue.severity == "warning").count();
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

    PreflightResult { jobs: results, blocking_issue_count, warning_count }
}

#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("文件路径为空".to_string());
    }
    let path = PathBuf::from(path);
    if let Some(parent) = path.parent().filter(|value| !value.as_os_str().is_empty()) {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(path, content).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    if path.trim().is_empty() {
        return Err("文件路径为空".to_string());
    }
    fs::read_to_string(path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn open_output(app: AppHandle, path: String) -> Result<(), String> {
    let target = path.trim().to_string();
    let path = Path::new(&target);
    if !path.exists() {
        return Err(format!("路径不存在：{}", path.display()));
    }
    app.opener()
        .open_path(target, None::<&str>)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_extraction(
    app: AppHandle,
    manifest_path: String,
    delete_replaced: bool,
) -> Result<DeleteExtractionResult, String> {
    delete_from_manifest(&app, &manifest_path, delete_replaced)
}

#[tauri::command]
pub fn install_claude_dat(directory: String, overwrite: bool) -> Result<String, String> {
    system_tools::install_claude_dat(&directory, overwrite)
}

#[tauri::command]
pub fn check_claude_cli() -> ClaudeCliStatus {
    system_tools::check_claude_cli()
}

#[tauri::command]
pub fn launch_claude_dat(directory: String) -> Result<ClaudeLaunchResult, String> {
    system_tools::launch_claude_dat(&directory)
}

#[tauri::command]
pub fn install_background_image(app: AppHandle, source: String) -> Result<String, String> {
    system_tools::install_background_image(&app, &source)
}

#[tauri::command]
pub fn clear_background_image(app: AppHandle) -> Result<(), String> {
    system_tools::clear_background_image(&app)
}

async fn acquire_with_control(
    app: &AppHandle,
    job: &ExtractionJob,
    control: &TaskControl,
    semaphore: Arc<Semaphore>,
    waiting_message: &str,
) -> Result<Option<OwnedSemaphorePermit>, String> {
    let mut pause_emitted = false;
    loop {
        if control.is_cancelled() {
            return Ok(None);
        }
        if control.is_paused() {
            if !pause_emitted {
                emit_progress(app, job, 0, "paused", "任务已暂停，等待继续后进入下一阶段");
                pause_emitted = true;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
            continue;
        }
        pause_emitted = false;
        emit_progress(app, job, 0, "queued", waiting_message);
        tokio::select! {
            permit = semaphore.clone().acquire_owned() => {
                return permit
                    .map(Some)
                    .map_err(|error| format!("任务调度器已关闭：{error}"));
            }
            _ = tokio::time::sleep(Duration::from_millis(100)) => {}
        }
    }
}

fn emit_progress(app: &AppHandle, job: &ExtractionJob, progress: u8, phase: &'static str, message: &str) {
    let _ = app.emit(
        "extract-progress",
        ProgressEvent {
            job_id: job.job_id.clone(),
            channel_id: job.channel_id.clone(),
            archive_path: job.archive_path.clone(),
            progress,
            phase,
            message: message.to_string(),
        },
    );
}

fn emit_finished(
    app: &AppHandle,
    job: &ExtractionJob,
    success: bool,
    output_path: Option<String>,
    error: Option<String>,
    duration_ms: u128,
    manifest_path: Option<String>,
    written_files: usize,
    replaced_files: usize,
) {
    let _ = app.emit(
        "extract-finished",
        JobFinishedEvent {
            job_id: job.job_id.clone(),
            channel_id: job.channel_id.clone(),
            archive_path: job.archive_path.clone(),
            success,
            output_path,
            error,
            duration_ms,
            manifest_path,
            written_files,
            replaced_files,
        },
    );
}
