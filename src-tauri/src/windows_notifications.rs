//! Windows toast identity and delivery for unpackaged/dev builds.
//! The stock notification plugin omits AppUserModelID in dev, so Windows shows PowerShell.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use tauri::AppHandle;

const APP_USER_MODEL_ID: &str = "com.forge.desktop";
const APP_DISPLAY_NAME: &str = "FORGE";
/// Forge accent (`--color-accent`); used as the notification icon tile background.
const APP_ICON_BACKGROUND: &str = "6366F1";

static TOAST_ICON: OnceLock<PathBuf> = OnceLock::new();

pub fn init(app: &AppHandle) {
    if let Some(icon_path) = crate::app_icon::resolve_icon_path(app) {
        let _ = TOAST_ICON.set(icon_path.clone());
        if let Err(err) = register_app_user_model_id(&icon_path) {
            eprintln!("[forge] failed to register notification identity: {err}");
        }
    } else {
        eprintln!("[forge] notification icon not found; toasts may use a generic icon");
    }
    if let Err(err) = set_process_app_user_model_id() {
        eprintln!("[forge] failed to set process AppUserModelID: {err}");
    }
}

pub fn show_automation_notification(automation_name: &str) -> Result<(), String> {
    if let Some(icon_path) = TOAST_ICON.get() {
        let _ = register_app_user_model_id(icon_path);
    }

    let automation_name = normalize_label(automation_name, "Untitled automation");

    let icon_xml = TOAST_ICON
        .get()
        .map(|icon| {
            format!(
                r#"<image placement="appLogoOverride" hint-crop="circle" src="{}" alt="{APP_DISPLAY_NAME}"/>"#,
                format_file_uri(icon)
            )
        })
        .unwrap_or_default();

    let xml = format!(
        r#"<toast>
            <visual>
                <binding template="ToastGeneric">
                    {icon_xml}
                    <text hint-style="title" hint-weight="bold">Automation Complete</text>
                    <text hint-style="subtitle">{automation_name}</text>
                </binding>
            </visual>
        </toast>"#,
        automation_name = escape_xml(&automation_name),
        icon_xml = icon_xml,
    );

    show_toast_xml(&xml)
}

pub fn show_agent_notification(
    workspace: &str,
    agent: &str,
    needs_attention: bool,
) -> Result<(), String> {
    if let Some(icon_path) = TOAST_ICON.get() {
        let _ = register_app_user_model_id(icon_path);
    }

    let workspace = normalize_label(workspace, "Workspace");
    let agent = normalize_label(agent, "Agent");
    let detail = if needs_attention {
        format!("{agent} needs attention")
    } else {
        format!("{agent} finished task")
    };

    let icon_xml = TOAST_ICON
        .get()
        .map(|icon| {
            format!(
                r#"<image placement="appLogoOverride" hint-crop="circle" src="{}" alt="{APP_DISPLAY_NAME}"/>"#,
                format_file_uri(icon)
            )
        })
        .unwrap_or_default();

    let xml = format!(
        r#"<toast>
            <visual>
                <binding template="ToastGeneric">
                    {icon_xml}
                    <text hint-style="title" hint-weight="bold">{app_name}</text>
                    <text hint-style="subtitle">{workspace}</text>
                    <text hint-style="captionSubtle">{detail}</text>
                </binding>
            </visual>
        </toast>"#,
        app_name = escape_xml(APP_DISPLAY_NAME),
        workspace = escape_xml(&workspace),
        detail = escape_xml(&detail),
        icon_xml = icon_xml,
    );

    show_toast_xml(&xml)
}

fn show_toast_xml(xml: &str) -> Result<(), String> {
    use windows::core::HSTRING;
    use windows::Data::Xml::Dom::XmlDocument;
    use windows::UI::Notifications::{ToastNotification, ToastNotificationManager};

    let doc = XmlDocument::new().map_err(|e| format!("{e:?}"))?;
    doc.LoadXml(&HSTRING::from(xml))
        .map_err(|e| format!("{e:?}"))?;
    let toast = ToastNotification::CreateToastNotification(&doc)
        .map_err(|e| format!("{e:?}"))?;
    let notifier =
        ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(APP_USER_MODEL_ID))
            .map_err(|e| format!("{e:?}"))?;
    notifier.Show(&toast).map_err(|e| format!("{e:?}"))?;
    Ok(())
}

fn normalize_label(value: &str, fallback: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        fallback.to_string()
    } else {
        trimmed.to_string()
    }
}

fn escape_xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn format_file_uri(path: &Path) -> String {
    let absolute = path
        .canonicalize()
        .unwrap_or_else(|_| path.to_path_buf());
    let normalized = absolute.display().to_string().replace('\\', "/");
    format!("file:///{normalized}")
}

fn register_app_user_model_id(icon_path: &Path) -> Result<(), String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let icon_uri = icon_path
        .canonicalize()
        .unwrap_or_else(|_| icon_path.to_path_buf());
    let icon_uri = icon_uri.to_string_lossy().into_owned();

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key_path = format!(r"Software\Classes\AppUserModelId\{APP_USER_MODEL_ID}");
    let (key, _) = hkcu
        .create_subkey(&key_path)
        .map_err(|e| e.to_string())?;

    key.set_value("DisplayName", &APP_DISPLAY_NAME)
        .map_err(|e| e.to_string())?;
    key.set_value("IconBackgroundColor", &APP_ICON_BACKGROUND)
        .map_err(|e| e.to_string())?;
    key.set_value("IconUri", &icon_uri)
        .map_err(|e| e.to_string())?;

    Ok(())
}

fn set_process_app_user_model_id() -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;

    let wide: Vec<u16> = std::ffi::OsStr::new(APP_USER_MODEL_ID)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let hr = unsafe { SetCurrentProcessExplicitAppUserModelID(wide.as_ptr()) };
    if hr != 0 {
        return Err(format!("SetCurrentProcessExplicitAppUserModelID failed: {hr}"));
    }
    Ok(())
}
