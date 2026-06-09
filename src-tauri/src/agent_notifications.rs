use tauri::AppHandle;

#[cfg_attr(windows, allow(unused_variables))]
#[tauri::command]
pub fn show_agent_finish_notification(
    app: AppHandle,
    workspace: String,
    agent: String,
    attention: Option<bool>,
) -> Result<(), String> {
    let needs_attention = attention.unwrap_or(false);

    #[cfg(windows)]
    {
        return crate::windows_notifications::show_agent_notification(
            &workspace,
            &agent,
            needs_attention,
        );
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
        let body = if needs_attention {
            format!("{workspace}\n{agent} needs attention")
        } else {
            format!("{workspace}\n{agent} finished task")
        };

        app.notification()
            .builder()
            .title("FORGE")
            .body(body)
            .show()
            .map_err(|e| e.to_string())
    }
}

#[cfg_attr(windows, allow(unused_variables))]
#[tauri::command]
pub fn show_automation_complete_notification(
    app: AppHandle,
    automation_name: String,
) -> Result<(), String> {
    #[cfg(windows)]
    {
        return crate::windows_notifications::show_automation_notification(&automation_name);
    }

    #[cfg(not(windows))]
    {
        use tauri::Manager;
        use tauri_plugin_notification::NotificationExt;

        let name = automation_name.trim();
        let name = if name.is_empty() {
            "Untitled automation"
        } else {
            name
        };

        app.notification()
            .builder()
            .title("Automation Complete")
            .body(name)
            .show()
            .map_err(|e| e.to_string())
    }
}
