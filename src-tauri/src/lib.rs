mod fs;
mod git;
mod github_auth;

use fs::list_directory;
use git::{
    git_clone, git_commit, git_fetch, git_init, git_pull, git_push, git_status,
};
use github_auth::{
    github_complete_device_login, github_fetch_user, github_poll_device_token,
    github_start_device_flow, github_wait_for_device_token,
};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            list_directory,
            git_status,
            git_pull,
            git_push,
            git_fetch,
            git_init,
            git_clone,
            git_commit,
            github_start_device_flow,
            github_poll_device_token,
            github_wait_for_device_token,
            github_complete_device_login,
            github_fetch_user,
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_theme(Some(tauri::Theme::Dark));
                let _ = window.set_shadow(false);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
