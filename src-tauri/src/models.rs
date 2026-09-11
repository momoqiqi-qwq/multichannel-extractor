use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartBatchRequest {
    pub jobs: Vec<ExtractionJob>,
    pub max_concurrency: usize,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractionJob {
    pub job_id: String,
    pub channel_id: String,
    pub archive_path: String,
    pub destination: String,
    pub use_archive_directory: bool,
    pub create_archive_subfolder: bool,
    pub deduplicate_archive_root: bool,
    pub collision_policy: CollisionPolicy,
    pub depth_mode: DepthMode,
    pub password: Option<String>,
    pub open_after: bool,
    pub skip_junk_files: bool,
    pub keep_empty_directories: bool,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CollisionPolicy {
    Rename,
    Overwrite,
    Skip,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum DepthMode {
    Preserve,
    Flatten { depth: usize },
    SkipOuter,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectedFile {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub format: String,
    pub supported: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub job_id: String,
    pub channel_id: String,
    pub archive_path: String,
    pub progress: u8,
    pub phase: &'static str,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobFinishedEvent {
    pub job_id: String,
    pub channel_id: String,
    pub archive_path: String,
    pub success: bool,
    pub output_path: Option<String>,
    pub error: Option<String>,
    pub duration_ms: u128,
    pub manifest_path: Option<String>,
    pub written_files: usize,
    pub replaced_files: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchFinishedEvent {
    pub batch_id: String,
    pub total: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub cancelled: usize,
}


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteExtractionResult {
    pub deleted_files: usize,
    pub skipped_replaced_files: usize,
    pub deleted_directories: usize,
}



#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveDirectoryScanRequest {
    pub directory: String,
    pub keywords: Vec<String>,
    pub match_mode: String,
    pub recursive: bool,
    pub prefer_highest_version: bool,
    pub include_prerelease: bool,
    pub max_candidates: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveDirectoryCandidate {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub format: String,
    pub version_label: Option<String>,
    pub version_parts: Vec<u64>,
    pub modified_unix: u64,
    pub matched_keywords: Vec<String>,
    pub prerelease: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveDirectoryScanResult {
    pub directory: String,
    pub keywords: Vec<String>,
    pub candidates: Vec<ArchiveDirectoryCandidate>,
    pub selected_path: Option<String>,
    pub selected_name: Option<String>,
    pub selection_reason: String,
    pub scanned_files: usize,
    pub matched_files: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeCliStatus {
    pub available: bool,
    pub executable: Option<String>,
    pub version: Option<String>,
    pub source: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeLaunchResult {
    pub working_directory: String,
    pub dat_path: String,
    pub command: String,
    pub launcher: String,
    pub process_id: u32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreflightRequest {
    pub jobs: Vec<ExtractionJob>,
    pub check_password: bool,
    pub check_disk_space: bool,
    pub check_conflicts: bool,
    pub minimum_free_bytes: u64,
    pub space_multiplier: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreflightIssue {
    pub code: String,
    pub severity: &'static str,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreflightJobResult {
    pub job_id: String,
    pub channel_id: String,
    pub archive_path: String,
    pub output_path: Option<String>,
    pub archive_size: u64,
    pub estimated_required_bytes: u64,
    pub available_bytes: Option<u64>,
    pub issues: Vec<PreflightIssue>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreflightResult {
    pub jobs: Vec<PreflightJobResult>,
    pub blocking_issue_count: usize,
    pub warning_count: usize,
}
