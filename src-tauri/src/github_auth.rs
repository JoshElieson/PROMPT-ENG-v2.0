use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const DEVICE_CODE_URL: &str = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";
const USER_API_URL: &str = "https://api.github.com/user";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceFlowPending {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubUser {
    pub id: u64,
    pub login: String,
    pub name: Option<String>,
    pub avatar_url: String,
    pub email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthSession {
    pub access_token: String,
    pub user: GitHubUser,
    pub login_at: u64,
}

async fn post_form(
    url: &str,
    body: &HashMap<String, String>,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let client = reqwest::Client::new();
    let res = client
        .post(url)
        .header("Accept", "application/json")
        .form(body)
        .send()
        .await
        .map_err(|e| format!("Network error contacting GitHub: {e}"))?;

    let status = res.status();
    let data: HashMap<String, serde_json::Value> = res
        .json()
        .await
        .map_err(|e| format!("Invalid response from GitHub: {e}"))?;

    if !status.is_success() {
        let message = data
            .get("error_description")
            .or_else(|| data.get("error"))
            .and_then(|v| v.as_str())
            .unwrap_or("GitHub request failed");
        return Err(message.to_string());
    }

    Ok(data)
}

fn value_as_string(map: &HashMap<String, serde_json::Value>, key: &str) -> Option<String> {
    map.get(key).and_then(|v| v.as_str()).map(str::to_string)
}

fn value_as_u64(map: &HashMap<String, serde_json::Value>, key: &str) -> Option<u64> {
    map.get(key).and_then(|v| v.as_u64())
}

async fn poll_device_token_once(
    client: &reqwest::Client,
    client_id: &str,
    device_code: &str,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let mut body: HashMap<String, String> = HashMap::new();
    body.insert("client_id".to_string(), client_id.to_string());
    body.insert("device_code".to_string(), device_code.to_string());
    body.insert(
        "grant_type".to_string(),
        "urn:ietf:params:oauth:grant-type:device_code".to_string(),
    );

    let res = client
        .post(ACCESS_TOKEN_URL)
        .header("Accept", "application/json")
        .form(&body)
        .send()
        .await
        .map_err(|e| format!("Network error contacting GitHub: {e}"))?;

    res.json()
        .await
        .map_err(|e| format!("Invalid response from GitHub: {e}"))
}

enum PollOutcome {
    Token(String),
    Pending,
    SlowDown,
}

fn parse_token_poll_response(
    data: HashMap<String, serde_json::Value>,
) -> Result<PollOutcome, String> {
    if let Some(token) = value_as_string(&data, "access_token") {
        return Ok(PollOutcome::Token(token));
    }

    let error = value_as_string(&data, "error").unwrap_or_default();
    match error.as_str() {
        "authorization_pending" => Ok(PollOutcome::Pending),
        "slow_down" => Ok(PollOutcome::SlowDown),
        "expired_token" => Err("The sign-in code expired. Please try again.".into()),
        "access_denied" => Err("GitHub sign-in was denied.".into()),
        "" => {
            let message = data
                .get("error_description")
                .and_then(|v| v.as_str())
                .unwrap_or("GitHub sign-in failed");
            Err(message.to_string())
        }
        _ => {
            let message = data
                .get("error_description")
                .and_then(|v| v.as_str())
                .unwrap_or(&error);
            Err(message.to_string())
        }
    }
}

async fn wait_for_device_token(
    client_id: &str,
    device_code: &str,
    interval_secs: u64,
    expires_in_secs: u64,
) -> Result<String, String> {
    let client_id = client_id.trim();
    let device_code = device_code.trim();
    if client_id.is_empty() {
        return Err("GitHub client ID is not configured.".into());
    }
    if device_code.is_empty() {
        return Err("Missing device code. Please try signing in again.".into());
    }

    let http = reqwest::Client::new();
    let deadline = Instant::now() + Duration::from_secs(expires_in_secs.max(60));
    let mut interval = Duration::from_secs(interval_secs.max(2));

    loop {
        if Instant::now() >= deadline {
            return Err("Sign-in timed out. Please try again.".into());
        }

        let data = poll_device_token_once(&http, client_id, device_code).await?;

        match parse_token_poll_response(data)? {
            PollOutcome::Token(token) => return Ok(token),
            PollOutcome::SlowDown => interval += Duration::from_secs(5),
            PollOutcome::Pending => {}
        }

        tokio::time::sleep(interval).await;
    }
}

async fn fetch_github_user(access_token: &str) -> Result<GitHubUser, String> {
    let access_token = access_token.trim();
    if access_token.is_empty() {
        return Err("Missing access token.".into());
    }

    let client = reqwest::Client::new();
    let res = client
        .get(USER_API_URL)
        .header("Accept", "application/vnd.github+json")
        .header("Authorization", format!("Bearer {access_token}"))
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await
        .map_err(|e| format!("Network error contacting GitHub: {e}"))?;

    if !res.status().is_success() {
        return Err("Could not load your GitHub profile.".into());
    }

    let data: GitHubUser = res
        .json()
        .await
        .map_err(|e| format!("Invalid profile response from GitHub: {e}"))?;

    Ok(data)
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[tauri::command]
pub async fn github_start_device_flow(
    client_id: String,
    scope: String,
) -> Result<DeviceFlowPending, String> {
    let client_id = client_id.trim().to_string();
    if client_id.is_empty() {
        return Err("GitHub client ID is not configured.".into());
    }

    let mut body: HashMap<String, String> = HashMap::new();
    body.insert("client_id".to_string(), client_id);
    body.insert("scope".to_string(), scope);

    let data = post_form(DEVICE_CODE_URL, &body).await?;

    let device_code = value_as_string(&data, "device_code")
        .ok_or("GitHub did not return a device code.")?;
    let user_code = value_as_string(&data, "user_code")
        .ok_or("GitHub did not return a user code.")?;
    let verification_uri = value_as_string(&data, "verification_uri")
        .ok_or("GitHub did not return a verification URL.")?;

    Ok(DeviceFlowPending {
        device_code,
        user_code,
        verification_uri,
        expires_in: value_as_u64(&data, "expires_in").unwrap_or(900),
        interval: value_as_u64(&data, "interval").unwrap_or(5),
    })
}

#[tauri::command]
pub async fn github_wait_for_device_token(
    client_id: String,
    device_code: String,
    interval_secs: u64,
    expires_in_secs: u64,
) -> Result<String, String> {
    wait_for_device_token(
        &client_id,
        &device_code,
        interval_secs,
        expires_in_secs,
    )
    .await
}

/// Wait for GitHub authorization, fetch the user profile, and return a session.
#[tauri::command]
pub async fn github_complete_device_login(
    client_id: String,
    device_code: String,
    interval_secs: u64,
    expires_in_secs: u64,
) -> Result<AuthSession, String> {
    let access_token = wait_for_device_token(
        &client_id,
        &device_code,
        interval_secs,
        expires_in_secs,
    )
    .await?;
    let user = fetch_github_user(&access_token).await?;

    Ok(AuthSession {
        access_token,
        user,
        login_at: now_ms(),
    })
}

#[tauri::command]
pub async fn github_fetch_user(access_token: String) -> Result<GitHubUser, String> {
    fetch_github_user(&access_token).await
}
