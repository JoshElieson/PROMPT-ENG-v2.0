use serde_json::json;
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Provider {
    OpenAi,
    Anthropic,
    Google,
    DeepSeek,
    Xai,
}

fn env_candidates() -> Vec<PathBuf> {
    let mut candidates = vec![PathBuf::from(".env"), PathBuf::from("../.env")];

    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            candidates.push(exe_dir.join(".env"));
            // Typical Tauri release layout: <root>\.updater\FORGE.exe
            if let Some(parent) = exe_dir.parent() {
                candidates.push(parent.join(".env"));
            }
        }
    }

    if let Ok(appdata) = std::env::var("APPDATA") {
        let base = PathBuf::from(appdata);
        candidates.push(base.join("FORGE").join(".env"));
        candidates.push(base.join("com.forge.desktop").join(".env"));
    }

    if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
        let base = PathBuf::from(local_appdata);
        candidates.push(base.join("FORGE").join(".env"));
        candidates.push(base.join("com.forge.desktop").join(".env"));
    }

    if let Ok(home) = std::env::var("HOME") {
        let base = PathBuf::from(home);
        candidates.push(base.join(".config").join("FORGE").join(".env"));
        candidates.push(base.join(".config").join("com.forge.desktop").join(".env"));
    }

    candidates
}

fn sanitize_env_value(value: &str) -> String {
    value
        .trim()
        .trim_matches(|c| c == '"' || c == '\'')
        .chars()
        .filter(|c| !c.is_control())
        .collect()
}

fn read_managed_backend_url_unnormalized() -> Option<String> {
    // Prefer compile-time values (beta installers) so a stray .env cannot override.
    let embedded = option_env!("FORGE_BACKEND_URL")
        .map(sanitize_env_value)
        .filter(|s| !s.is_empty());
    if embedded.is_some() {
        return embedded;
    }
    std::env::var("FORGE_BACKEND_URL")
        .ok()
        .map(|s| sanitize_env_value(&s))
        .filter(|s| !s.is_empty())
}

fn normalize_managed_backend_url(raw: &str) -> Result<String, String> {
    let mut url = sanitize_env_value(raw);
    if url.is_empty() {
        return Err("FORGE_BACKEND_URL is empty.".to_string());
    }
    if !url.starts_with("http://") && !url.starts_with("https://") {
        url = format!("https://{url}");
    }
    let parsed = url::Url::parse(&url)
        .map_err(|e| format!("FORGE_BACKEND_URL is not a valid URL ({url}): {e}"))?;
    let host = parsed
        .host_str()
        .ok_or_else(|| format!("FORGE_BACKEND_URL is missing a host: {url}"))?;
    validate_managed_backend_host(host)?;
    Ok(url.trim_end_matches('/').to_string())
}

fn validate_managed_backend_host(host: &str) -> Result<(), String> {
    if host == "localhost" || host.starts_with("127.") {
        return Ok(());
    }
    if !host.contains('.') {
        return Err(format!(
            "FORGE_BACKEND_URL host \"{host}\" is not a public URL. \
Use the full Render address from your dashboard, e.g. https://your-service-name.onrender.com \
(not an internal service ID or slug by itself)."
        ));
    }
    Ok(())
}

fn managed_backend_url_raw() -> Option<String> {
    let raw = read_managed_backend_url_unnormalized()?;
    normalize_managed_backend_url(&raw).ok()
}

fn managed_backend_token_raw() -> Option<String> {
    let embedded = option_env!("FORGE_BACKEND_TOKEN")
        .map(sanitize_env_value)
        .filter(|s| !s.is_empty());
    if embedded.is_some() {
        return embedded;
    }
    std::env::var("FORGE_BACKEND_TOKEN")
        .ok()
        .map(|s| sanitize_env_value(&s))
        .filter(|s| !s.is_empty())
}

pub fn has_managed_backend() -> bool {
    read_managed_backend_url_unnormalized().is_some()
}

/// Validates managed-backend settings; call before chat when `has_managed_backend()` is true.
pub fn validate_managed_backend_config() -> Result<(), String> {
    if !has_managed_backend() {
        return Ok(());
    }
    let raw = read_managed_backend_url_unnormalized()
        .ok_or_else(|| "FORGE_BACKEND_URL is not set.".to_string())?;
    let _ = normalize_managed_backend_url(&raw)?;
    if managed_backend_token_raw().is_none() {
        return Err(
            "FORGE_BACKEND_TOKEN is not set. It must match BACKEND_CLIENT_TOKEN on your Render service."
                .to_string(),
        );
    }
    Ok(())
}

fn managed_backend_url_for_provider(provider: Provider) -> Option<String> {
    let base = managed_backend_url_raw()?;
    let base = base.trim_end_matches('/');
    let suffix = match provider {
        Provider::OpenAi => "/openai/v1",
        Provider::Anthropic => "/anthropic",
        Provider::Google => "/gemini/v1beta",
        Provider::DeepSeek => "/deepseek/v1",
        Provider::Xai => "/xai/v1",
    };
    Some(format!("{base}{suffix}"))
}

pub fn load_dotenv() {
    // Release builds embed the Render URL at compile time — never overlay a stray .env.
    if option_env!("FORGE_BACKEND_URL").is_some() {
        return;
    }
    // Managed backend already configured via process env — skip .env so local provider keys cannot override.
    if read_managed_backend_url_unnormalized().is_some() {
        return;
    }
    for path in env_candidates() {
        if path.is_file() {
            let _ = dotenvy::from_path(&path);
            break;
        }
    }
}

pub fn provider_for_model(model_id: &str) -> Option<Provider> {
    if model_id.starts_with("gemini") {
        return Some(Provider::Google);
    }
    if model_id.starts_with("claude") {
        return Some(Provider::Anthropic);
    }
    if model_id.starts_with("gpt-") || model_id.starts_with("chatgpt-") {
        return Some(Provider::OpenAi);
    }
    if model_id.starts_with("o1") || model_id.starts_with("o3") || model_id.starts_with("o4") {
        return Some(Provider::OpenAi);
    }
    if model_id.starts_with("deepseek") {
        return Some(Provider::DeepSeek);
    }
    if model_id.starts_with("grok") {
        return Some(Provider::Xai);
    }
    match model_id {
        "gpt4o" | "gpt4-turbo" | "o1" => Some(Provider::OpenAi),
        "deepseek" => Some(Provider::DeepSeek),
        _ => None,
    }
}

pub fn api_key(provider: Provider) -> Option<String> {
    if has_managed_backend() {
        return managed_backend_token_raw().or_else(|| {
            // Legacy fallback when backend has no BACKEND_CLIENT_TOKEN set.
            Some("forge-desktop-managed".to_string())
        });
    }
    let key = match provider {
        Provider::OpenAi => std::env::var("OPENAI_API_KEY"),
        Provider::Anthropic => std::env::var("ANTHROPIC_API_KEY"),
        Provider::Google => std::env::var("GEMINI_API_KEY"),
        Provider::DeepSeek => std::env::var("DEEPSEEK_API_KEY"),
        Provider::Xai => std::env::var("GROK_API_KEY")
            .or_else(|_| std::env::var("XAI_API_KEY")),
    };
    key.ok()
        .map(|s| sanitize_env_value(&s))
        .filter(|s| !s.is_empty())
}

fn validate_api_key_format(provider: Provider, key: &str) -> Result<(), String> {
    match provider {
        Provider::DeepSeek if key.starts_with("sk-ant-") => Err(
            "DEEPSEEK_API_KEY looks like an Anthropic key (sk-ant-…). \
Use a DeepSeek key from https://platform.deepseek.com instead."
                .to_string(),
        ),
        Provider::Anthropic
            if key.starts_with("sk-ant-your")
                || key.eq_ignore_ascii_case("sk-ant-api03-your-key-here") =>
        {
            Err(
                "ANTHROPIC_API_KEY is still the .env.example placeholder. \
Set a real key from https://console.anthropic.com or remove Claude from the Round Table."
                    .to_string(),
            )
        }
        _ => Ok(()),
    }
}

pub fn base_url(provider: Provider, default: &str) -> String {
    if let Some(url) = managed_backend_url_for_provider(provider) {
        return url;
    }
    let var = match provider {
        Provider::OpenAi => "OPENAI_BASE_URL",
        Provider::Anthropic => "ANTHROPIC_BASE_URL",
        Provider::Google => "GEMINI_BASE_URL",
        Provider::DeepSeek => "DEEPSEEK_BASE_URL",
        Provider::Xai => "XAI_BASE_URL",
    };
    if let Some(url) = std::env::var(var)
        .ok()
        .map(|s| sanitize_env_value(&s))
        .filter(|s| !s.is_empty())
    {
        return url;
    }
    default.to_string()
}

fn provider_name(provider: Provider) -> &'static str {
    match provider {
        Provider::OpenAi => "OpenAI",
        Provider::Anthropic => "Anthropic",
        Provider::Google => "Gemini",
        Provider::DeepSeek => "DeepSeek",
        Provider::Xai => "xAI",
    }
}

fn lowercase_trimmed(value: &str) -> String {
    value.trim().to_ascii_lowercase()
}

pub fn validate_resolved_model(provider: Provider, api_model: &str) -> Result<(), String> {
    let model = lowercase_trimmed(api_model);
    let matches_provider = match provider {
        Provider::OpenAi => {
            !(model.starts_with("claude")
                || model.starts_with("gemini")
                || model.starts_with("deepseek")
                || model.starts_with("grok"))
        }
        Provider::Anthropic => model.starts_with("claude"),
        Provider::Google => model.starts_with("gemini"),
        Provider::DeepSeek => model.starts_with("deepseek"),
        Provider::Xai => model.starts_with("grok"),
    };

    if matches_provider {
        return Ok(());
    }

    let hint = match provider {
        Provider::OpenAi => "Use OPENAI_MODEL for GPT/o-series models only.",
        Provider::Anthropic => "Use ANTHROPIC_MODEL with a Claude model id.",
        Provider::Google => "Use GEMINI_MODEL with a Gemini model id.",
        Provider::DeepSeek => "Use DEEPSEEK_MODEL with a DeepSeek model id.",
        Provider::Xai => "Use XAI_MODEL with a Grok model id.",
    };

    Err(format!(
        "Resolved model \"{api_model}\" is not compatible with {}. {hint}",
        provider_name(provider)
    ))
}

pub fn validate_base_url(provider: Provider, url: &str) -> Result<(), String> {
    let lower = lowercase_trimmed(url);
    if lower.is_empty() {
        return Ok(());
    }

    let looks_like_anthropic = lower.contains("anthropic.com");
    let looks_like_openai = lower.contains("openai.com");
    let looks_like_gemini = lower.contains("generativelanguage.googleapis.com");
    let looks_like_deepseek = lower.contains("deepseek.com");
    let looks_like_xai = lower.contains("x.ai");

    let mismatch = match provider {
        Provider::OpenAi => looks_like_anthropic || looks_like_gemini || looks_like_deepseek || looks_like_xai,
        Provider::Anthropic => looks_like_openai || looks_like_gemini || looks_like_deepseek || looks_like_xai,
        Provider::Google => looks_like_openai || looks_like_anthropic || looks_like_deepseek || looks_like_xai,
        Provider::DeepSeek => looks_like_openai || looks_like_anthropic || looks_like_gemini || looks_like_xai,
        Provider::Xai => looks_like_openai || looks_like_anthropic || looks_like_gemini || looks_like_deepseek,
    };

    if mismatch {
        return Err(format!(
            "{} base URL appears to target a different provider: {}",
            provider_name(provider),
            url.trim()
        ));
    }

    Ok(())
}

pub fn resolve_api_model(model_id: &str) -> Result<(Provider, String), String> {
    validate_managed_backend_config()?;
    let model_id = model_id.trim();
    let provider = provider_for_model(model_id).ok_or_else(|| {
        format!(
            "Model \"{model_id}\" is not wired to a provider yet. Supported prefixes: gemini*, claude*, gpt-*, chatgpt-*, o1*, o3*, o4*, deepseek*, grok*; legacy ids: gpt4o, gpt4-turbo, o1, deepseek."
        )
    })?;

    let key = api_key(provider).ok_or_else(|| {
        if has_managed_backend() {
            "Managed backend mode is enabled but FORGE_BACKEND_URL or FORGE_BACKEND_TOKEN is missing or invalid. \
Set both (Render URL + token matching BACKEND_CLIENT_TOKEN), then rebuild or restart the app."
                .to_string()
        } else {
            let env = match provider {
                Provider::OpenAi => "OPENAI_API_KEY",
                Provider::Anthropic => "ANTHROPIC_API_KEY",
                Provider::Google => "GEMINI_API_KEY",
                Provider::DeepSeek => "DEEPSEEK_API_KEY",
                Provider::Xai => "GROK_API_KEY (or XAI_API_KEY)",
            };
            format!(
                "Missing {env}. Configure FORGE_BACKEND_URL for managed mode (Render), or set {env} for local provider mode."
            )
        }
    })?;
    if !has_managed_backend() {
        validate_api_key_format(provider, &key)?;
    }

    let model = match provider {
        Provider::OpenAi => resolve_openai_model(model_id),
        Provider::Anthropic => resolve_anthropic_model(model_id),
        Provider::Google => resolve_gemini_model(model_id),
        Provider::DeepSeek => resolve_deepseek_model(model_id),
        Provider::Xai => resolve_xai_model(model_id),
    };
    validate_resolved_model(provider, &model)?;

    Ok((provider, model))
}

fn resolve_openai_model(model_id: &str) -> String {
    if model_id.starts_with("gpt-")
        || model_id.starts_with("chatgpt-")
        || model_id.starts_with("o1")
        || model_id.starts_with("o3")
        || model_id.starts_with("o4")
    {
        return model_id.to_string();
    }
    if let Some(m) = std::env::var("OPENAI_MODEL").ok().filter(|s| !s.trim().is_empty()) {
        return m;
    }
    match model_id {
        "gpt4o" => "gpt-4o".to_string(),
        "gpt4-turbo" => "gpt-4-turbo".to_string(),
        "o1" => "o1".to_string(),
        _ => "gpt-4o".to_string(),
    }
}

fn resolve_anthropic_model(model_id: &str) -> String {
    if model_id.starts_with("claude-") {
        return model_id.to_string();
    }
    if let Some(m) = std::env::var("ANTHROPIC_MODEL")
        .ok()
        .filter(|s| !s.trim().is_empty())
    {
        return m;
    }
    match model_id {
        "claude" => "claude-sonnet-4-6".to_string(),
        "claude-opus" => "claude-opus-4-8".to_string(),
        _ => "claude-sonnet-4-6".to_string(),
    }
}

fn resolve_gemini_model(model_id: &str) -> String {
    if model_id.starts_with("gemini-") {
        return model_id.to_string();
    }
    if let Some(m) = std::env::var("GEMINI_MODEL")
        .ok()
        .filter(|s| !s.trim().is_empty())
    {
        return m;
    }
    match model_id {
        "gemini" => "gemini-2.5-pro".to_string(),
        "gemini-flash" => "gemini-2.0-flash".to_string(),
        _ => "gemini-2.0-flash".to_string(),
    }
}

fn resolve_deepseek_model(model_id: &str) -> String {
    if model_id.starts_with("deepseek-") {
        return model_id.to_string();
    }
    if let Some(m) = std::env::var("DEEPSEEK_MODEL")
        .ok()
        .filter(|s| !s.trim().is_empty())
    {
        return m;
    }
    match model_id {
        "deepseek" => "deepseek-chat".to_string(),
        _ => "deepseek-chat".to_string(),
    }
}

fn normalize_xai_api_model(model: &str) -> String {
    match model.trim() {
        // Legacy app id / old docs — not on current xAI keys
        "grok" | "grok-2" | "grok-2-latest" | "grok-beta" => "grok-4.3".to_string(),
        other => other.to_string(),
    }
}

fn resolve_xai_model(model_id: &str) -> String {
    if model_id.starts_with("grok-") {
        return normalize_xai_api_model(model_id);
    }
    if let Some(m) = std::env::var("XAI_MODEL")
        .ok()
        .filter(|s| !s.trim().is_empty())
    {
        return normalize_xai_api_model(&m);
    }
    match model_id {
        "grok" => "grok-4.3".to_string(),
        "grok-fast" => "grok-4.20-0309-non-reasoning".to_string(),
        "grok-reasoning" => "grok-4.20-0309-reasoning".to_string(),
        "grok-multi" => "grok-4.20-multi-agent-0309".to_string(),
        "grok-code" => "grok-build-0.1".to_string(),
        _ => "grok-4.3".to_string(),
    }
}

/// Pick a provider that has a key configured (for synthesis).
pub fn default_synthesis_provider() -> Option<(Provider, String)> {
    for provider in [
        Provider::OpenAi,
        Provider::Anthropic,
        Provider::Google,
        Provider::DeepSeek,
        Provider::Xai,
    ] {
        if api_key(provider).is_some() {
            let model_id = match provider {
                Provider::OpenAi => "gpt4o",
                Provider::Anthropic => "claude",
                Provider::Google => "gemini",
                Provider::DeepSeek => "deepseek",
                Provider::Xai => "grok",
            };
            if let Ok((p, m)) = resolve_api_model(model_id) {
                return Some((p, m));
            }
        }
    }
    None
}

/// Prefer a provider from models that actually responded; fall back to global order.
pub fn synthesis_provider_for_models(model_ids: &[&str]) -> Option<(Provider, String)> {
    for model_id in model_ids {
        if let Ok(pair) = resolve_api_model(model_id) {
            return Some(pair);
        }
    }
    default_synthesis_provider()
}

/// Desktop connectivity summary for beta troubleshooting.
#[tauri::command]
pub fn ai_connection_status() -> serde_json::Value {
    let config_error = if has_managed_backend() {
        validate_managed_backend_config()
            .err()
            .map(|e| e.to_string())
    } else {
        None
    };
    json!({
        "managedBackend": has_managed_backend(),
        "backendUrl": managed_backend_url_raw(),
        "backendTokenConfigured": managed_backend_token_raw().is_some(),
        "configError": config_error,
    })
}
