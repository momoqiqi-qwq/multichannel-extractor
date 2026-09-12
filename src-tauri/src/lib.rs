mod archive;
mod claude_cli;
mod commands;
mod commands_preflight;
mod directory_scan;
mod models;
mod system_tools;
mod task_control;
mod task_manifest;

use commands::{
    cancel_job, check_claude_cli, clear_background_image, delete_extraction,
    get_download_directory, inspect_files, install_background_image, install_claude_dat,
    launch_claude_dat, open_output, pause_job, read_text_file, resume_job, scan_archive_directory,
    start_batch, startup_archive_paths, write_text_file, TaskRegistry,
};
use commands_preflight::preflight_jobs;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(TaskRegistry::default())
        .invoke_handler(tauri::generate_handler![
            inspect_files,
            startup_archive_paths,
            scan_archive_directory,
            get_download_directory,
            start_batch,
            cancel_job,
            pause_job,
            resume_job,
            preflight_jobs,
            write_text_file,
            read_text_file,
            open_output,
            delete_extraction,
            install_claude_dat,
            check_claude_cli,
            launch_claude_dat,
            install_background_image,
            clear_background_image
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
