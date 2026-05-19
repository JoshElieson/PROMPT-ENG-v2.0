use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const DEVICE_CODE_URL: &str = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";
const USER_API_URL: &str = "https://api.github.com/user";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceFlowPending {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitHubUser {
    pub id: u64,
    pub login: String,
    pub name: Option<String>,
    pub avatar_url: String,
    pub email: Option<String>,
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase", tag = "status")]
pub enum DeviceTokenPollResult {
    Token { access_token: String },
    Pending,
    SlowDown,
}

#[tauri::command]
pub async fn github_poll_device_token(
    client_id: String,
    device_code: String,
) -> Result<DeviceTokenPollResult, String> {
    let client_id = client_id.trim().to_string();
    if client_id.is_empty() {
        return Err("GitHub client ID is not configured.".into());
    }

    let mut body: HashMap<String, String> = HashMap::new();
    body.insert("client_id".to_string(), client_id);
    body.insert("device_code".to_string(), device_code);
    body.insert(
        "grant_type".to_string(),
        "urn:ietf:params:oauth:grant-type:device_code".to_string(),
    );

    let client = reqwest::Client::new();
    let res = client
        .post(ACCESS_TOKEN_URL)
        .header("Accept", "application/json")
        .form(&body)
        .send()
        .await
        .map_err(|e| format!("Network error contacting GitHub: {e}"))?;

    let data: HashMap<String, serde_json::Value> = res
        .json()
        .await
        .map_err(|e| format!("Invalid response from GitHub: {e}"))?;

    if let Some(token) = value_as_string(&data, "access_token") {
        return Ok(DeviceTokenPollResult::Token {
            access_token: token,
        });
    }

    let error = value_as_string(&data, "error").unwrap_or_default();
    match error.as_str() {
        "authorization_pending" => Ok(DeviceTokenPollResult::Pending),
        "slow_down" => Ok(DeviceTokenPollResult::SlowDown),
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

#[tauri::command]
pub async fn github_fetch_user(access_token: String) -> Result<GitHubUser, String> {
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
