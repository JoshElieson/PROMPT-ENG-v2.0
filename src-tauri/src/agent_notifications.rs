use tauri::AppHandle;

#[cfg_attr(windows, allow(unused_variables))]
#[tauri::command]
pub fn show_agent_finish_notification(
    app: AppHandle,
    workspace: String,
    agent: String,
) -> Result<(), String> {
    #[cfg(windows)]
    {
        return crate::windows_notifications::show_agent_finished(&workspace, &agent);
    }

    #[cfg(not(windows))]
    {
        use tauri::Manager;
        use tauri_plugin_notification::NotificationExt;

        let workspace = workspace.trim();
        let agent = agent.trim();
        let workspace = if workspace.is_empty() {
            "Workspace"
        } else {
            workspace
        };
        let agent = if agent.is_empty() { "Agent" } else { agent };
        let body = format!("{workspace}\n{agent} finished task");

        app.notification()
            .builder()
            .title("FORGE")
            .body(body)
            .show()
            .map_err(|e| e.to_string())
    }
}
