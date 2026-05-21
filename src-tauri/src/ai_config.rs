use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Provider {
    OpenAi,
    Anthropic,
    Google,
    DeepSeek,
    Xai,
}

pub fn load_dotenv() {
    let candidates = [
        PathBuf::from(".env"),
        PathBuf::from("../.env"),
    ];
    for path in candidates {
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
    match model_id {
        "gpt4o" | "gpt4-turbo" | "o1" => Some(Provider::OpenAi),
        "claude" | "claude-opus" => Some(Provider::Anthropic),
        "deepseek" => Some(Provider::DeepSeek),
        "grok" | "grok-fast" | "grok-reasoning" | "grok-multi" | "grok-code" => {
            Some(Provider::Xai)
        }
        _ => None,
    }
}

pub fn api_key(provider: Provider) -> Option<String> {
    let key = match provider {
        Provider::OpenAi => std::env::var("OPENAI_API_KEY"),
        Provider::Anthropic => std::env::var("ANTHROPIC_API_KEY"),
        Provider::Google => std::env::var("GEMINI_API_KEY"),
        Provider::DeepSeek => std::env::var("DEEPSEEK_API_KEY"),
        Provider::Xai => std::env::var("GROK_API_KEY")
            .or_else(|_| std::env::var("XAI_API_KEY")),
    };
    key.ok()
        .map(|s| s.trim().to_string())
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
    let var = match provider {
        Provider::OpenAi => "OPENAI_BASE_URL",
        Provider::Anthropic => "ANTHROPIC_BASE_URL",
        Provider::Google => "GEMINI_BASE_URL",
        Provider::DeepSeek => "DEEPSEEK_BASE_URL",
        Provider::Xai => "XAI_BASE_URL",
    };
    std::env::var(var)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| default.to_string())
}

pub fn resolve_api_model(model_id: &str) -> Result<(Provider, String), String> {
    let model_id = model_id.trim();
    let provider = provider_for_model(model_id).ok_or_else(|| {
        format!(
            "Model \"{model_id}\" is not wired to a provider yet. Supported: gpt4o, gpt4-turbo, o1, claude, claude-opus, gemini, gemini-flash, deepseek, grok, grok-fast, grok-reasoning, grok-multi, grok-code."
        )
    })?;

    let key = api_key(provider).ok_or_else(|| {
        let env = match provider {
            Provider::OpenAi => "OPENAI_API_KEY",
            Provider::Anthropic => "ANTHROPIC_API_KEY",
            Provider::Google => "GEMINI_API_KEY",
            Provider::DeepSeek => "DEEPSEEK_API_KEY",
            Provider::Xai => "GROK_API_KEY (or XAI_API_KEY)",
        };
        format!("Missing {env} in .env. Add your API key and restart the app.")
    })?;
    validate_api_key_format(provider, &key)?;

    let model = match provider {
        Provider::OpenAi => resolve_openai_model(model_id),
        Provider::Anthropic => resolve_anthropic_model(model_id),
        Provider::Google => resolve_gemini_model(model_id),
        Provider::DeepSeek => resolve_deepseek_model(model_id),
        Provider::Xai => resolve_xai_model(model_id),
    };

    Ok((provider, model))
}

fn resolve_openai_model(model_id: &str) -> String {
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
    if let Some(m) = std::env::var("ANTHROPIC_MODEL")
        .ok()
        .filter(|s| !s.trim().is_empty())
    {
        return m;
    }
    match model_id {
        "claude" => "claude-sonnet-4-20250514".to_string(),
        "claude-opus" => "claude-opus-4-20250514".to_string(),
        _ => "claude-sonnet-4-20250514".to_string(),
    }
}

fn resolve_gemini_model(model_id: &str) -> String {
    if let Some(m) = std::env::var("GEMINI_MODEL")
        .ok()
        .filter(|s| !s.trim().is_empty())
    {
        return m;
    }
    if model_id.starts_with("gemini-") {
        return model_id.to_string();
    }
    match model_id {
        "gemini" => "gemini-2.5-pro".to_string(),
        "gemini-flash" => "gemini-2.0-flash".to_string(),
        _ => "gemini-2.0-flash".to_string(),
    }
}

fn resolve_deepseek_model(model_id: &str) -> String {
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
