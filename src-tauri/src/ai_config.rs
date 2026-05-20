use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Provider {
    OpenAi,
    Anthropic,
    Google,
    DeepSeek,
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
        _ => None,
    }
}

pub fn api_key(provider: Provider) -> Option<String> {
    let key = match provider {
        Provider::OpenAi => std::env::var("OPENAI_API_KEY"),
        Provider::Anthropic => std::env::var("ANTHROPIC_API_KEY"),
        Provider::Google => std::env::var("GEMINI_API_KEY"),
        Provider::DeepSeek => std::env::var("DEEPSEEK_API_KEY"),
    };
    key.ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

pub fn base_url(provider: Provider, default: &str) -> String {
    let var = match provider {
        Provider::OpenAi => "OPENAI_BASE_URL",
        Provider::Anthropic => "ANTHROPIC_BASE_URL",
        Provider::Google => "GEMINI_BASE_URL",
        Provider::DeepSeek => "DEEPSEEK_BASE_URL",
    };
    std::env::var(var)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| default.to_string())
}

pub fn resolve_api_model(model_id: &str) -> Result<(Provider, String), String> {
    let provider = provider_for_model(model_id).ok_or_else(|| {
        format!(
            "Model \"{model_id}\" is not wired to a provider yet. Supported: gpt4o, gpt4-turbo, o1, claude, claude-opus, gemini, gemini-flash, deepseek."
        )
    })?;

    if api_key(provider).is_none() {
        let env = match provider {
            Provider::OpenAi => "OPENAI_API_KEY",
            Provider::Anthropic => "ANTHROPIC_API_KEY",
            Provider::Google => "GEMINI_API_KEY",
            Provider::DeepSeek => "DEEPSEEK_API_KEY",
        };
        return Err(format!(
            "Missing {env} in .env. Add your API key and restart the app."
        ));
    }

    let model = match provider {
        Provider::OpenAi => resolve_openai_model(model_id),
        Provider::Anthropic => resolve_anthropic_model(model_id),
        Provider::Google => resolve_gemini_model(model_id),
        Provider::DeepSeek => resolve_deepseek_model(model_id),
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

/// Pick a provider that has a key configured (for synthesis).
pub fn default_synthesis_provider() -> Option<(Provider, String)> {
    for provider in [
        Provider::OpenAi,
        Provider::Anthropic,
        Provider::Google,
        Provider::DeepSeek,
    ] {
        if api_key(provider).is_some() {
            let model_id = match provider {
                Provider::OpenAi => "gpt4o",
                Provider::Anthropic => "claude",
                Provider::Google => "gemini",
                Provider::DeepSeek => "deepseek",
            };
            if let Ok((p, m)) = resolve_api_model(model_id) {
                return Some((p, m));
            }
        }
    }
    None
}
