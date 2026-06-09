use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

const TRAY_ID: &str = "main-tray";

#[tauri::command]
pub fn set_system_tray_visible(app: AppHandle, visible: bool) -> Result<(), String> {
    if visible {
        if let Some(tray) = app.tray_by_id(TRAY_ID) {
            tray.set_visible(true).map_err(|e| e.to_string())?;
            return Ok(());
        }

        let icon = app
            .default_window_icon()
            .ok_or_else(|| "No default app icon".to_string())?
            .clone();

        TrayIconBuilder::with_id(TRAY_ID)
            .icon(icon)
            .tooltip("FORGE")
            .on_tray_icon_event(|tray, event| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event
                {
                    let app = tray.app_handle();
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                }
            })
            .build(&app)
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_visible(false).map_err(|e| e.to_string())?;
    }

    Ok(())
}
