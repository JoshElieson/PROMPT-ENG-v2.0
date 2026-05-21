use crate::ai_config::{api_key, base_url, Provider};
use std::sync::Mutex;
use std::time::{Duration, Instant};

const CACHE_TTL: Duration = Duration::from_secs(300);

/// Chat-capable models on the account, in preference order (newest general model first).
const PREFERRED_CHAT_MODELS: &[&str] = &[
    "grok-4.3",
    "grok-4.20-0309-reasoning",
    "grok-4.20-0309-non-reasoning",
    "grok-4.20-multi-agent-0309",
    "grok-build-0.1",
];

static LANGUAGE_MODEL_CACHE: Mutex<Option<(Instant, Vec<String>)>> = Mutex::new(None);

/// Fetch text chat model ids enabled for the current API key (`GET /v1/language-models`).
pub async fn fetch_account_chat_model_ids() -> Vec<String> {
    let key = match api_key(Provider::Xai) {
        Some(k) => k,
        None => return Vec::new(),
    };

    if let Ok(cache) = LANGUAGE_MODEL_CACHE.lock() {
        if let Some((fetched_at, ids)) = cache.as_ref() {
            if fetched_at.elapsed() < CACHE_TTL {
                return ids.clone();
            }
        }
    }

    let base = base_url(Provider::Xai, "https://api.x.ai/v1");
    let url = format!("{}/language-models", base.trim_end_matches('/'));

    let client = match reqwest::Client::builder()
        .user_agent("FORGE/2.0 (Tauri)")
        .build()
    {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let res = match client
        .get(&url)
        .header("Authorization", format!("Bearer {key}"))
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => return Vec::new(),
    };

    let raw = match res.text().await {
        Ok(t) => t,
        Err(_) => return Vec::new(),
    };

    let data: serde_json::Value = serde_json::from_str(&raw).unwrap_or(serde_json::json!({}));
    let mut ids: Vec<String> = data["models"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|m| {
            m["output_modalities"]
                .as_array()
                .map(|mods| mods.iter().any(|v| v.as_str() == Some("text")))
                .unwrap_or(false)
        })
        .filter_map(|m| m["id"].as_str().map(str::to_string))
        .collect();

    ids.sort();
    ids.dedup();

    if let Ok(mut cache) = LANGUAGE_MODEL_CACHE.lock() {
        *cache = Some((Instant::now(), ids.clone()));
    }

    ids
}

/// Pick the best chat model available on this API key.
pub async fn default_account_chat_model() -> String {
    let available = fetch_account_chat_model_ids().await;
    for preferred in PREFERRED_CHAT_MODELS {
        if available.iter().any(|id| id == preferred) {
            return (*preferred).to_string();
        }
    }
    available
        .first()
        .cloned()
        .unwrap_or_else(|| "grok-4.3".to_string())
}

pub fn invalidate_cache() {
    if let Ok(mut cache) = LANGUAGE_MODEL_CACHE.lock() {
        *cache = None;
    }
}

pub fn is_model_not_found_error(err: &str) -> bool {
    err.contains("Model not found") || err.contains("model_not_found")
}

/// Use the requested model when possible; otherwise pick one the key can access.
pub async fn resolve_runtime_model(requested: &str) -> String {
    let requested = requested.trim();
    let available = fetch_account_chat_model_ids().await;

    if available.is_empty() {
        return requested.to_string();
    }

    if available.iter().any(|id| id == requested) {
        return requested.to_string();
    }

    default_account_chat_model().await
}
