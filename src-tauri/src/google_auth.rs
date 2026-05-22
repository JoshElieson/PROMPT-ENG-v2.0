use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::Rng;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::time::{Duration, Instant};
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::time::timeout;

use crate::github_auth::{AuthSession, GitHubUser};

const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const USERINFO_URL: &str = "https://www.googleapis.com/oauth2/v2/userinfo";
const SCOPES: &str = "openid email profile";
const CALLBACK_TIMEOUT: Duration = Duration::from_secs(300);
const VERIFIER_CHARS: &[u8] =
    b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

fn generate_pkce() -> (String, String) {
    let mut rng = rand::thread_rng();
    let verifier: String = (0..64)
        .map(|_| {
            let idx = rng.gen_range(0..VERIFIER_CHARS.len());
            VERIFIER_CHARS[idx] as char
        })
        .collect();
    let digest = Sha256::digest(verifier.as_bytes());
    let challenge = URL_SAFE_NO_PAD.encode(digest);
    (verifier, challenge)
}

fn random_state() -> String {
    let mut rng = rand::thread_rng();
    (0..16)
        .map(|_| format!("{:02x}", rng.gen_range(0..=255)))
        .collect()
}

fn pick_loopback_port() -> Result<u16, String> {
    let listener = std::net::TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Could not start local sign-in server: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Could not read local sign-in port: {e}"))?
        .port();
    drop(listener);
    Ok(port)
}

fn parse_oauth_callback(request: &str) -> Result<(String, String), String> {
    let request_line = request
        .lines()
        .next()
        .ok_or_else(|| "Invalid OAuth callback.".to_string())?;

    let path = request_line
        .split_whitespace()
        .nth(1)
        .ok_or_else(|| "Invalid OAuth callback.".to_string())?;

    let query = path.split('?').nth(1).unwrap_or("");
    let mut code: Option<String> = None;
    let mut state: Option<String> = None;
    let mut oauth_error: Option<String> = None;

    for (key, value) in url::form_urlencoded::parse(query.as_bytes()) {
        match key.as_ref() {
            "code" => code = Some(value.into_owned()),
            "state" => state = Some(value.into_owned()),
            "error" => oauth_error = Some(value.into_owned()),
            _ => {}
        }
    }

    if let Some(err) = oauth_error {
        return Err(format!("Google sign-in failed ({err})."));
    }

    let code = code.ok_or_else(|| "Google did not return an authorization code.".to_string())?;
    let state = state.ok_or_else(|| "Google did not return sign-in state.".to_string())?;
    Ok((code, state))
}

async fn wait_for_oauth_callback(
    port: u16,
    expected_state: &str,
) -> Result<String, String> {
    let listener = TcpListener::bind(format!("127.0.0.1:{port}"))
        .await
        .map_err(|e| format!("Could not start local sign-in server: {e}"))?;

    let started = Instant::now();

    loop {
        if started.elapsed() >= CALLBACK_TIMEOUT {
            return Err("Google sign-in timed out. Please try again.".to_string());
        }

        let remaining = CALLBACK_TIMEOUT.saturating_sub(started.elapsed());
        let accept = timeout(remaining, listener.accept()).await;

        let Ok(Ok((mut stream, _))) = accept else {
            return Err("Google sign-in timed out. Please try again.".to_string());
        };

        let mut buffer = vec![0u8; 8192];
        let read = stream
            .read(&mut buffer)
            .await
            .map_err(|e| format!("Could not read OAuth callback: {e}"))?;
        let request = String::from_utf8_lossy(&buffer[..read]);

        match parse_oauth_callback(&request) {
            Ok((code, state)) => {
                if state != expected_state {
                    write_http_response(
                        &mut stream,
                        400,
                        "State mismatch. Return to Forge and try again.",
                    )
                    .await?;
                    return Err("Google sign-in state mismatch. Please try again.".to_string());
                }

                write_http_response(
                    &mut stream,
                    200,
                    "Sign-in complete. You can close this tab and return to Forge.",
                )
                .await?;
                return Ok(code);
            }
            Err(message) => {
                write_http_response(&mut stream, 400, &message).await?;
                return Err(message);
            }
        }
    }
}

async fn write_http_response(
    stream: &mut tokio::net::TcpStream,
    status: u16,
    body_text: &str,
) -> Result<(), String> {
    let status_text = if status == 200 { "OK" } else { "Bad Request" };
    let body = format!(
        "<!doctype html><html><body style=\"font-family:system-ui,sans-serif;padding:2rem\"><p>{}</p></body></html>",
        body_text
    );
    let response = format!(
        "HTTP/1.1 {status} {status_text}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    stream
        .write_all(response.as_bytes())
        .await
        .map_err(|e| format!("Could not write OAuth callback response: {e}"))?;
    stream
        .flush()
        .await
        .map_err(|e| format!("Could not flush OAuth callback response: {e}"))?;
    Ok(())
}

#[derive(Debug, Deserialize)]
struct GoogleTokenResponse {
    access_token: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GoogleUserInfo {
    id: Option<String>,
    email: Option<String>,
    name: Option<String>,
    picture: Option<String>,
}

fn resolve_client_secret(provided: Option<String>) -> Option<String> {
    provided
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .or_else(|| {
            std::env::var("VITE_GOOGLE_CLIENT_SECRET")
                .ok()
                .or_else(|| std::env::var("GOOGLE_CLIENT_SECRET").ok())
        })
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

async fn exchange_code(
    client_id: &str,
    client_secret: Option<&str>,
    code: &str,
    redirect_uri: &str,
    code_verifier: &str,
) -> Result<String, String> {
    let mut form: Vec<(&str, &str)> = vec![
        ("client_id", client_id),
        ("code", code),
        ("code_verifier", code_verifier),
        ("grant_type", "authorization_code"),
        ("redirect_uri", redirect_uri),
    ];
    if let Some(secret) = client_secret {
        form.push(("client_secret", secret));
    }

    let client = reqwest::Client::new();
    let res = client
        .post(TOKEN_URL)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .form(&form)
        .send()
        .await
        .map_err(|e| format!("Network error contacting Google: {e}"))?;

    let data: GoogleTokenResponse = res
        .json()
        .await
        .map_err(|e| format!("Invalid token response from Google: {e}"))?;

    if let Some(token) = data.access_token {
        return Ok(token);
    }

    Err(data
        .error_description
        .or(data.error)
        .unwrap_or_else(|| "Google token exchange failed".to_string()))
}

async fn fetch_google_user(access_token: &str) -> Result<GitHubUser, String> {
    let client = reqwest::Client::new();
    let res = client
        .get(USERINFO_URL)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| format!("Network error loading Google profile: {e}"))?;

    if !res.status().is_success() {
        return Err("Could not load your Google profile.".to_string());
    }

    let profile: GoogleUserInfo = res
        .json()
        .await
        .map_err(|e| format!("Invalid profile response from Google: {e}"))?;

    let email = profile.email;
    let login = email
        .as_ref()
        .and_then(|value| value.split('@').next())
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or_else(|| profile.id.clone())
        .unwrap_or_else(|| "user".to_string());

    let id = profile
        .id
        .as_deref()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(0);

    Ok(GitHubUser {
        id,
        login,
        name: profile.name,
        avatar_url: profile.picture.unwrap_or_default(),
        email,
    })
}

#[tauri::command]
pub async fn google_complete_oauth(
    app: AppHandle,
    client_id: String,
    client_secret: Option<String>,
) -> Result<AuthSession, String> {
    let client_id = client_id.trim();
    if client_id.is_empty() {
        return Err("Google client ID is not configured.".to_string());
    }
    let client_secret = resolve_client_secret(client_secret);

    let port = pick_loopback_port()?;
    let redirect_uri = format!("http://127.0.0.1:{port}/oauth/callback");
    let (code_verifier, code_challenge) = generate_pkce();
    let state = random_state();

    let mut auth_url =
        url::Url::parse(AUTH_URL).map_err(|e| format!("Invalid Google auth URL: {e}"))?;
    {
        let mut query = auth_url.query_pairs_mut();
        query.append_pair("client_id", client_id);
        query.append_pair("redirect_uri", &redirect_uri);
        query.append_pair("response_type", "code");
        query.append_pair("scope", SCOPES);
        query.append_pair("code_challenge", &code_challenge);
        query.append_pair("code_challenge_method", "S256");
        query.append_pair("state", &state);
        query.append_pair("access_type", "online");
        query.append_pair("prompt", "select_account");
    }
    let auth_url = auth_url.to_string();

    app.opener()
        .open_url(auth_url, None::<&str>)
        .map_err(|e| format!("Could not open browser for Google sign-in: {e}"))?;

    let code = wait_for_oauth_callback(port, &state).await?;
    let access_token = exchange_code(
        client_id,
        client_secret.as_deref(),
        &code,
        &redirect_uri,
        &code_verifier,
    )
    .await?;
    let user = fetch_google_user(&access_token).await?;

    Ok(AuthSession {
        access_token,
        user,
        provider: "google".to_string(),
        login_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0),
    })
}
