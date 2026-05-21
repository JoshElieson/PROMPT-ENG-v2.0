use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, State, WebviewUrl};
use url::Url;

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Clone, Default)]
pub struct BrowserWebviewState(Arc<Mutex<HashMap<String, BrowserSession>>>);

impl BrowserWebviewState {
    pub fn get_active_sessions(&self) -> Vec<String> {
        let sessions = self.0.lock().expect("browser state lock");
        sessions.keys().cloned().collect()
    }
}

struct BrowserSession {
    history: Vec<String>,
    index: usize,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BrowserNavigatedPayload {
    id: String,
    url: String,
    can_go_back: bool,
    can_go_forward: bool,
}

fn webview_label(id: &str) -> String {
    format!("browser-{id}")
}

fn parse_url(url: &str) -> Result<Url, String> {
    url.parse::<Url>().or_else(|_| {
        let with_scheme = format!("https://{}", url);
        with_scheme.parse::<Url>()
    }).map_err(|e| e.to_string())
}

/// Normalize URLs so history entries match despite trailing slashes, fragments, etc.
fn normalize_url(url: &str) -> String {
    let Ok(mut parsed) = url.parse::<Url>() else {
        return url.trim().to_string();
    };
    parsed.set_fragment(None);
    let path = parsed.path().to_string();
    if path.len() > 1 && path.ends_with('/') {
        let trimmed = &path[..path.len() - 1];
        let _ = parsed.set_path(trimmed);
    }
    parsed.to_string()
}

fn session_flags(session: &BrowserSession) -> (bool, bool) {
    (
        session.index > 0,
        session.index + 1 < session.history.len(),
    )
}

fn with_webview<F>(app: &AppHandle, id: &str, f: F) -> Result<(), String>
where
    F: FnOnce(tauri::Webview) -> Result<(), String>,
{
    let label = webview_label(id);
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| format!("browser webview '{label}' not found"))?;
    f(webview)
}

fn record_navigation(
    state: &BrowserWebviewState,
    id: &str,
    url: &str,
) -> (bool, bool) {
    let mut sessions = state.0.lock().expect("browser state lock");
    let session = sessions
        .entry(id.to_string())
        .or_insert_with(|| BrowserSession {
            history: vec![url.to_string()],
            index: 0,
        });

    let normalized = normalize_url(url);

    if session
        .history
        .get(session.index)
        .is_some_and(|entry| normalize_url(entry) == normalized)
    {
        return session_flags(session);
    }

    if session.index > 0
        && normalize_url(&session.history[session.index - 1]) == normalized
    {
        session.index -= 1;
        return session_flags(session);
    }

    if session.index + 1 < session.history.len()
        && normalize_url(&session.history[session.index + 1]) == normalized
    {
        session.index += 1;
        return session_flags(session);
    }

    if let Some(index) = session
        .history
        .iter()
        .position(|entry| normalize_url(entry) == normalized)
    {
        session.index = index;
        return session_flags(session);
    }

    session.history.truncate(session.index + 1);
    session.history.push(url.to_string());
    session.index = session.history.len() - 1;
    session_flags(session)
}

fn emit_navigation(
    app: &AppHandle,
    id: &str,
    url: &str,
    can_go_back: bool,
    can_go_forward: bool,
) {
    let _ = app.emit(
        "browser-navigated",
        BrowserNavigatedPayload {
            id: id.to_string(),
            url: url.to_string(),
            can_go_back,
            can_go_forward,
        },
    );
}

#[tauri::command]
pub async fn browser_webview_open(
    app: AppHandle,
    state: State<'_, BrowserWebviewState>,
    id: String,
    url: String,
    bounds: BrowserBounds,
) -> Result<(), String> {
    let parsed = parse_url(&url)?;
    let label = webview_label(&id);

    if app.get_webview(&label).is_some() {
        browser_webview_navigate(app.clone(), id.clone(), url).await?;
        return browser_webview_set_bounds(app, id, bounds).await;
    }

    {
        let mut sessions = state.0.lock().expect("browser state lock");
        sessions.insert(
            id.clone(),
            BrowserSession {
                history: vec![url.clone()],
                index: 0,
            },
        );
    }

    let window = app
        .get_window("main")
        .ok_or_else(|| "main window not found".to_string())?;

    let tab_id = id.clone();
    let app_for_nav = app.clone();
    let state_for_nav = (*state).clone();

    let webview_result = window
        .add_child(
            tauri::webview::WebviewBuilder::new(&label, WebviewUrl::External(parsed))
                .on_navigation(move |nav_url| {
                    let url_str = nav_url.to_string();
                    let (can_go_back, can_go_forward) =
                        record_navigation(&state_for_nav, &tab_id, &url_str);
                    emit_navigation(
                        &app_for_nav,
                        &tab_id,
                        &url_str,
                        can_go_back,
                        can_go_forward,
                    );
                    true
                }),
            LogicalPosition::new(bounds.x, bounds.y),
            LogicalSize::new(bounds.width.max(1.0), bounds.height.max(1.0)),
        );

    let webview = match webview_result {
        Ok(wv) => wv,
        Err(e) => {
            let err_str = e.to_string();
            if err_str.contains("already exists") {
                // If it already exists, just navigate and update bounds.
                browser_webview_navigate(app.clone(), id.clone(), url).await?;
                return browser_webview_set_bounds(app, id, bounds).await;
            }
            return Err(err_str);
        }
    };

    if bounds.width < 1.0 || bounds.height < 1.0 {
        webview.hide().map_err(|e| e.to_string())?;
    } else {
        webview.show().map_err(|e| e.to_string())?;
    }

    emit_navigation(&app, &id, &url, false, false);
    Ok(())
}

#[tauri::command]
pub async fn browser_webview_navigate(
    app: AppHandle,
    id: String,
    url: String,
) -> Result<(), String> {
    let parsed = parse_url(&url)?;
    with_webview(&app, &id, |webview| webview.navigate(parsed).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn browser_webview_go_back(
    app: AppHandle,
    state: State<'_, BrowserWebviewState>,
    id: String,
) -> Result<(), String> {
    let target = {
        let mut sessions = state.0.lock().expect("browser state lock");
        let session = sessions
            .get_mut(&id)
            .ok_or_else(|| format!("browser session '{id}' not found"))?;
        if session.index == 0 {
            return Ok(());
        }
        session.index -= 1;
        session.history[session.index].clone()
    };

    let parsed = parse_url(&target)?;
    with_webview(&app, &id, |webview| webview.navigate(parsed).map_err(|e| e.to_string()))?;

    let (can_go_back, can_go_forward) = {
        let sessions = state.0.lock().expect("browser state lock");
        let session = sessions.get(&id).expect("browser session");
        session_flags(session)
    };
    emit_navigation(&app, &id, &target, can_go_back, can_go_forward);
    Ok(())
}

#[tauri::command]
pub async fn browser_webview_go_forward(
    app: AppHandle,
    state: State<'_, BrowserWebviewState>,
    id: String,
) -> Result<(), String> {
    let target = {
        let mut sessions = state.0.lock().expect("browser state lock");
        let session = sessions
            .get_mut(&id)
            .ok_or_else(|| format!("browser session '{id}' not found"))?;
        if session.index + 1 >= session.history.len() {
            return Ok(());
        }
        session.index += 1;
        session.history[session.index].clone()
    };

    let parsed = parse_url(&target)?;
    with_webview(&app, &id, |webview| webview.navigate(parsed).map_err(|e| e.to_string()))?;

    let (can_go_back, can_go_forward) = {
        let sessions = state.0.lock().expect("browser state lock");
        let session = sessions.get(&id).expect("browser session");
        session_flags(session)
    };
    emit_navigation(&app, &id, &target, can_go_back, can_go_forward);
    Ok(())
}

#[tauri::command]
pub async fn browser_webview_reload(app: AppHandle, id: String) -> Result<(), String> {
    with_webview(&app, &id, |webview| webview.reload().map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn browser_webview_set_bounds(
    app: AppHandle,
    id: String,
    bounds: BrowserBounds,
) -> Result<(), String> {
    with_webview(&app, &id, |webview| {
        webview
            .set_position(LogicalPosition::new(bounds.x, bounds.y))
            .map_err(|e| e.to_string())?;
        webview
            .set_size(LogicalSize::new(
                bounds.width.max(1.0),
                bounds.height.max(1.0),
            ))
            .map_err(|e| e.to_string())?;
        Ok(())
    })
}

#[tauri::command]
pub async fn browser_webview_set_visible(
    app: AppHandle,
    id: String,
    visible: bool,
) -> Result<(), String> {
    with_webview(&app, &id, |webview| {
        if visible {
            webview.show().map_err(|e| e.to_string())
        } else {
            webview.hide().map_err(|e| e.to_string())
        }
    })
}

#[tauri::command]
pub async fn browser_webview_close(
    app: AppHandle,
    state: State<'_, BrowserWebviewState>,
    id: String,
) -> Result<(), String> {
    let label = webview_label(&id);
    if let Some(webview) = app.get_webview(&label) {
        webview.close().map_err(|e| e.to_string())?;
    }
    state.0.lock().expect("browser state lock").remove(&id);
    Ok(())
}
