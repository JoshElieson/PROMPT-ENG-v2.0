use crate::ai_config::{
    api_key, base_url, default_synthesis_provider, resolve_api_model, Provider,
};
use crate::ai_workspace::{
    tool_clear_directory, tool_list_directory, tool_read_file, tool_remove_path, tool_write_file,
    AiWorkspace, WorkspacePolicy,
};
use serde::{Deserialize, Serialize};
use serde_json::json;

const FORGE_USER_AGENT: &str = "FORGE/2.0 (Tauri)";
const MAX_TOOL_ROUNDS: u32 = 14;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatTurn {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelResponse {
    pub model_id: String,
    #[serde(default)]
    pub model_name: Option<String>,
    pub content: String,
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(FORGE_USER_AGENT)
        .build()
        .map_err(|e| format!("Could not create HTTP client: {e}"))
}

fn provider_error(provider: Provider, context: &str, detail: &str) -> String {
    let name = match provider {
        Provider::OpenAi => "OpenAI",
        Provider::Anthropic => "Anthropic",
        Provider::Google => "Gemini",
        Provider::DeepSeek => "DeepSeek",
    };
    format!("{name} {context}: {detail}")
}

fn tools_schema_openai() -> Vec<serde_json::Value> {
    vec![
        json!({
            "type": "function",
            "function": {
                "name": "read_file",
                "description": "Read a UTF-8 text file under the user's AI-enabled paths (absolute path). Prefer this over guessing whenever the user's question depends on source, configs, docs, or logs.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Absolute file path" }
                    },
                    "required": ["path"]
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "write_file",
                "description": "Create or overwrite a UTF-8 text file under the user's AI-enabled paths; parent dirs are created. Use to apply edits or add files the user asked for—read existing files first when merging or partial edits matter.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Absolute file path" },
                        "content": { "type": "string", "description": "Full new file contents" }
                    },
                    "required": ["path", "content"]
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "list_directory",
                "description": "List files and subfolders under an AI-enabled directory (absolute path). Use to discover paths, layout, or where to read next when you are not sure which file to open.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Absolute directory path" }
                    },
                    "required": ["path"]
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "remove_path",
                "description": "Permanently delete a file or subfolder (recursive). Works on individually AI-enabled files. For an AI-enabled folder root, use clear_directory instead of deleting that folder path.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Absolute file or directory path" }
                    },
                    "required": ["path"]
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "clear_directory",
                "description": "Delete every file and subfolder inside a directory but keep the directory. Use to empty/clear a folder for a fresh start. Pass the folder's absolute path (parent folders are allowed when children are AI-enabled).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Absolute directory path" }
                    },
                    "required": ["path"]
                }
            }
        }),
    ]
}

const CODE_FORMATTING_GUIDANCE: &str = "\n\
Formatting:\n\
- When sharing code, commands, or config snippets, use fenced markdown code blocks with a language tag (e.g. ```python).\n\
- Put a short plain-language intro before or after the block when helpful; keep the code itself inside the fence.\n";

const DEFAULT_CHAT_SYSTEM: &str = "You are a helpful assistant in a multi-model AI workspace. \
When sharing code or shell commands, use fenced markdown code blocks with a language tag (e.g. ```python).";

fn chat_system_prompt(user: Option<&str>) -> String {
    match user.map(str::trim).filter(|s| !s.is_empty()) {
        Some(custom) => format!("{custom}{CODE_FORMATTING_GUIDANCE}"),
        None => DEFAULT_CHAT_SYSTEM.to_string(),
    }
}

fn workspace_system_prompt(policy: &WorkspacePolicy) -> String {
    format!(
        "The user enabled the following locations for AI file access. You have tools read_file, write_file, list_directory, remove_path, and clear_directory to work on their real project on disk.\n\
\n\
How to work:\n\
- Whenever the request depends on this codebase (behavior, errors, structure, config, or \"what does X do\"), use list_directory and/or read_file early instead of guessing.\n\
- When the user wants changes, fixes, refactors, or new files, carry them out with write_file after reading any files you need to change safely.\n\
- When the user asks to delete files, remove folders, or empty/clear a directory, use remove_path or clear_directory—do not claim deletion without calling a tool.\n\
- To empty a folder but keep the folder itself, call clear_directory with that folder's absolute path (works even when only files inside are AI-enabled).\n\
- remove_path deletes any file, including individually AI-enabled files. It deletes subfolders recursively. Only an AI-enabled folder root itself must be cleared with clear_directory, not remove_path.\n\
- If you are unsure which file matters, list_directory near the roots below, then read the most relevant paths.\n\
\n\
Rules:\n\
- Only access paths under these AI-enabled locations (absolute paths):\n{}\n\
- Prefer read_file or list_directory before overwriting files.\n\
- write_file replaces the entire file contents; it does not delete files.\n\
- remove_path cannot delete an AI-enabled folder root in one step—use clear_directory on that folder instead.\n\
- Use absolute paths exactly as they appear on disk.{CODE_FORMATTING_GUIDANCE}",
        policy.roots_summary()
    )
}

fn run_tool(policy: &WorkspacePolicy, name: &str, args: &str) -> String {
    let result = (|| -> Result<String, String> {
        let v: serde_json::Value =
            serde_json::from_str(args).map_err(|e| format!("Invalid tool arguments JSON: {e}"))?;
        match name {
            "read_file" => {
                let path = v["path"]
                    .as_str()
                    .ok_or_else(|| "read_file: missing path".to_string())?;
                tool_read_file(policy, path)
            }
            "write_file" => {
                let path = v["path"]
                    .as_str()
                    .ok_or_else(|| "write_file: missing path".to_string())?;
                let content = v["content"].as_str().unwrap_or("");
                tool_write_file(policy, path, content)
            }
            "list_directory" | "list_dir" => {
                let path = v["path"]
                    .as_str()
                    .ok_or_else(|| "list_directory: missing path".to_string())?;
                tool_list_directory(policy, path)
            }
            "remove_path" | "delete_path" | "delete_file" | "remove_file" => {
                let path = v["path"]
                    .as_str()
                    .ok_or_else(|| "remove_path: missing path".to_string())?;
                tool_remove_path(policy, path)
            }
            "clear_directory" | "empty_directory" => {
                let path = v["path"]
                    .as_str()
                    .ok_or_else(|| "clear_directory: missing path".to_string())?;
                tool_clear_directory(policy, path)
            }
            _ => Err(format!("Unknown tool: {name}")),
        }
    })();
    match result {
        Ok(s) => s,
        Err(e) => format!("ERROR: {e}"),
    }
}

fn model_supports_tools(model_id: &str) -> bool {
    !matches!(model_id, "o1")
}

async fn complete_openai(
    api_model: &str,
    messages: &[ChatTurn],
    system: Option<&str>,
) -> Result<String, String> {
    let key = api_key(Provider::OpenAi).expect("key checked");
    let base = base_url(Provider::OpenAi, "https://api.openai.com/v1");
    let url = format!("{}/chat/completions", base.trim_end_matches('/'));

    let mut api_messages: Vec<serde_json::Value> = Vec::new();
    if let Some(sys) = system {
        api_messages.push(json!({
            "role": "system",
            "content": sys,
        }));
    }
    for turn in messages {
        let role = if turn.role == "assistant" {
            "assistant"
        } else {
            "user"
        };
        api_messages.push(json!({
            "role": role,
            "content": turn.content,
        }));
    }

    let body = json!({
        "model": api_model,
        "messages": api_messages,
        "max_tokens": 4096,
    });

    let client = http_client()?;
    let res = client
        .post(&url)
        .header("Authorization", format!("Bearer {key}"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| provider_error(Provider::OpenAi, "request failed", &e.to_string()))?;

    let status = res.status();
    let data: serde_json::Value = res
        .json()
        .await
        .map_err(|e| provider_error(Provider::OpenAi, "invalid response", &e.to_string()))?;

    if !status.is_success() {
        let detail = data["error"]["message"]
            .as_str()
            .or_else(|| data["error"].as_str())
            .unwrap_or("Unknown error");
        return Err(provider_error(
            Provider::OpenAi,
            &format!("HTTP {status}"),
            detail,
        ));
    }

    data["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| {
            provider_error(Provider::OpenAi, "response", "missing message content")
        })
}

async fn openai_agent_loop(
    api_model: &str,
    chat_messages: &[ChatTurn],
    policy: &WorkspacePolicy,
) -> Result<String, String> {
    let key = api_key(Provider::OpenAi).expect("key checked");
    let base = base_url(Provider::OpenAi, "https://api.openai.com/v1");
    let url = format!("{}/chat/completions", base.trim_end_matches('/'));
    let client = http_client()?;
    let tools = tools_schema_openai();

    let mut api_messages: Vec<serde_json::Value> = vec![json!({
        "role": "system",
        "content": workspace_system_prompt(policy),
    })];
    for turn in chat_messages {
        let role = if turn.role == "assistant" {
            "assistant"
        } else {
            "user"
        };
        api_messages.push(json!({ "role": role, "content": turn.content }));
    }

    for _ in 0..MAX_TOOL_ROUNDS {
        let body = json!({
            "model": api_model,
            "messages": api_messages,
            "tools": tools,
            "tool_choice": "auto",
            "max_tokens": 4096,
        });

        let res = client
            .post(&url)
            .header("Authorization", format!("Bearer {}", key.as_str()))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| provider_error(Provider::OpenAi, "request failed", &e.to_string()))?;

        let status = res.status();
        let data: serde_json::Value = res
            .json()
            .await
            .map_err(|e| provider_error(Provider::OpenAi, "invalid response", &e.to_string()))?;

        if !status.is_success() {
            let detail = data["error"]["message"]
                .as_str()
                .unwrap_or("Unknown error");
            return Err(provider_error(
                Provider::OpenAi,
                &format!("HTTP {status}"),
                detail,
            ));
        }

        let msg = &data["choices"][0]["message"];
        let tool_calls = msg["tool_calls"].as_array();

        if let Some(calls) = tool_calls {
            if !calls.is_empty() {
                api_messages.push(msg.clone());

                for call in calls {
                    let id = call["id"].as_str().unwrap_or("");
                    let name = call["function"]["name"].as_str().unwrap_or("");
                    let args = call["function"]["arguments"].as_str().unwrap_or("{}");
                    let output = run_tool(policy, name, args);
                    api_messages.push(json!({
                        "role": "tool",
                        "tool_call_id": id,
                        "content": output,
                    }));
                }
                continue;
            }
        }

        return msg["content"]
            .as_str()
            .map(|s| s.to_string())
            .filter(|s| !s.trim().is_empty())
            .ok_or_else(|| {
                provider_error(Provider::OpenAi, "response", "empty assistant message")
            });
    }

    Err("OpenAI: stopped after too many tool rounds (possible loop).".to_string())
}

async fn complete_deepseek(
    api_model: &str,
    messages: &[ChatTurn],
    system: Option<&str>,
) -> Result<String, String> {
    let key = api_key(Provider::DeepSeek).expect("key checked");
    let base = base_url(Provider::DeepSeek, "https://api.deepseek.com/v1");
    let url = format!("{}/chat/completions", base.trim_end_matches('/'));

    let mut api_messages: Vec<serde_json::Value> = Vec::new();
    if let Some(sys) = system {
        api_messages.push(json!({
            "role": "system",
            "content": sys,
        }));
    }
    for turn in messages {
        let role = if turn.role == "assistant" {
            "assistant"
        } else {
            "user"
        };
        api_messages.push(json!({
            "role": role,
            "content": turn.content,
        }));
    }

    let body = json!({
        "model": api_model,
        "messages": api_messages,
        "max_tokens": 4096,
    });

    let client = http_client()?;
    let res = client
        .post(&url)
        .header("Authorization", format!("Bearer {key}"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| provider_error(Provider::DeepSeek, "request failed", &e.to_string()))?;

    let status = res.status();
    let data: serde_json::Value = res
        .json()
        .await
        .map_err(|e| provider_error(Provider::DeepSeek, "invalid response", &e.to_string()))?;

    if !status.is_success() {
        let detail = data["error"]["message"]
            .as_str()
            .or_else(|| data["error"].as_str())
            .unwrap_or("Unknown error");
        return Err(provider_error(
            Provider::DeepSeek,
            &format!("HTTP {status}"),
            detail,
        ));
    }

    data["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| {
            provider_error(Provider::DeepSeek, "response", "missing message content")
        })
}

async fn deepseek_agent_loop(
    api_model: &str,
    chat_messages: &[ChatTurn],
    policy: &WorkspacePolicy,
) -> Result<String, String> {
    let key = api_key(Provider::DeepSeek).expect("key checked");
    let base = base_url(Provider::DeepSeek, "https://api.deepseek.com/v1");
    let url = format!("{}/chat/completions", base.trim_end_matches('/'));
    let client = http_client()?;
    let tools = tools_schema_openai();

    let mut api_messages: Vec<serde_json::Value> = vec![json!({
        "role": "system",
        "content": workspace_system_prompt(policy),
    })];
    for turn in chat_messages {
        let role = if turn.role == "assistant" {
            "assistant"
        } else {
            "user"
        };
        api_messages.push(json!({ "role": role, "content": turn.content }));
    }

    for _ in 0..MAX_TOOL_ROUNDS {
        let body = json!({
            "model": api_model,
            "messages": api_messages,
            "tools": tools,
            "tool_choice": "auto",
            "max_tokens": 4096,
        });

        let res = client
            .post(&url)
            .header("Authorization", format!("Bearer {}", key.as_str()))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| provider_error(Provider::DeepSeek, "request failed", &e.to_string()))?;

        let status = res.status();
        let data: serde_json::Value = res
            .json()
            .await
            .map_err(|e| provider_error(Provider::DeepSeek, "invalid response", &e.to_string()))?;

        if !status.is_success() {
            let detail = data["error"]["message"]
                .as_str()
                .unwrap_or("Unknown error");
            return Err(provider_error(
                Provider::DeepSeek,
                &format!("HTTP {status}"),
                detail,
            ));
        }

        let msg = &data["choices"][0]["message"];
        let tool_calls = msg["tool_calls"].as_array();

        if let Some(calls) = tool_calls {
            if !calls.is_empty() {
                api_messages.push(msg.clone());

                for call in calls {
                    let id = call["id"].as_str().unwrap_or("");
                    let name = call["function"]["name"].as_str().unwrap_or("");
                    let args = call["function"]["arguments"].as_str().unwrap_or("{}");
                    let output = run_tool(policy, name, args);
                    api_messages.push(json!({
                        "role": "tool",
                        "tool_call_id": id,
                        "content": output,
                    }));
                }
                continue;
            }
        }

        return msg["content"]
            .as_str()
            .map(|s| s.to_string())
            .filter(|s| !s.trim().is_empty())
            .ok_or_else(|| {
                provider_error(Provider::DeepSeek, "response", "empty assistant message")
            });
    }

    Err("DeepSeek: stopped after too many tool rounds (possible loop).".to_string())
}

fn anthropic_tools() -> Vec<serde_json::Value> {
    vec![
        json!({
            "name": "read_file",
            "description": "Read a UTF-8 text file under AI-enabled paths. Prefer this over guessing when the answer depends on source, configs, docs, or logs.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Absolute file path" }
                },
                "required": ["path"]
            }
        }),
        json!({
            "name": "write_file",
            "description": "Create or overwrite a UTF-8 text file under AI-enabled paths. Use to persist edits or new files; read existing files first when merges or partial edits matter.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": { "type": "string" },
                    "content": { "type": "string" }
                },
                "required": ["path", "content"]
            }
        }),
        json!({
            "name": "list_directory",
            "description": "List files and subfolders under an AI-enabled directory. Use to find paths or project layout before reading files.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Absolute directory path" }
                },
                "required": ["path"]
            }
        }),
        json!({
            "name": "remove_path",
            "description": "Permanently delete a file or folder (recursive). Use when the user asks to delete; do not claim deletion without this tool.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Absolute file or directory path" }
                },
                "required": ["path"]
            }
        }),
        json!({
            "name": "clear_directory",
            "description": "Delete all files and subfolders inside a directory but keep the directory. Use to empty or clear a folder.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Absolute directory path" }
                },
                "required": ["path"]
            }
        }),
    ]
}

async fn complete_anthropic(
    api_model: &str,
    messages: &[ChatTurn],
    system: Option<&str>,
) -> Result<String, String> {
    let key = api_key(Provider::Anthropic).expect("key checked");
    let base = base_url(Provider::Anthropic, "https://api.anthropic.com");
    let url = format!("{}/v1/messages", base.trim_end_matches('/'));

    let mut api_messages: Vec<serde_json::Value> = Vec::new();
    for turn in messages {
        let role = if turn.role == "assistant" {
            "assistant"
        } else {
            "user"
        };
        api_messages.push(json!({
            "role": role,
            "content": turn.content,
        }));
    }

    let mut body = json!({
        "model": api_model,
        "max_tokens": 4096,
        "messages": api_messages,
    });
    if let Some(sys) = system {
        body["system"] = json!(sys);
    }

    let client = http_client()?;
    let res = client
        .post(&url)
        .header("x-api-key", key.as_str())
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| provider_error(Provider::Anthropic, "request failed", &e.to_string()))?;

    let status = res.status();
    let data: serde_json::Value = res
        .json()
        .await
        .map_err(|e| provider_error(Provider::Anthropic, "invalid response", &e.to_string()))?;

    if !status.is_success() {
        let detail = data["error"]["message"].as_str().unwrap_or("Unknown error");
        return Err(provider_error(
            Provider::Anthropic,
            &format!("HTTP {status}"),
            detail,
        ));
    }

    let content = &data["content"];
    if let Some(arr) = content.as_array() {
        let text: String = arr
            .iter()
            .filter_map(|block| {
                if block["type"].as_str() == Some("text") {
                    block["text"].as_str()
                } else {
                    None
                }
            })
            .collect();
        if !text.is_empty() {
            return Ok(text);
        }
    }

    Err(provider_error(
        Provider::Anthropic,
        "response",
        "missing message content",
    ))
}

async fn anthropic_agent_loop(
    api_model: &str,
    chat_messages: &[ChatTurn],
    policy: &WorkspacePolicy,
) -> Result<String, String> {
    let key = api_key(Provider::Anthropic).expect("key checked");
    let base = base_url(Provider::Anthropic, "https://api.anthropic.com");
    let url = format!("{}/v1/messages", base.trim_end_matches('/'));
    let client = http_client()?;
    let tools = anthropic_tools();

    let mut api_messages: Vec<serde_json::Value> = Vec::new();
    for turn in chat_messages {
        let role = if turn.role == "assistant" {
            "assistant"
        } else {
            "user"
        };
        api_messages.push(json!({
            "role": role,
            "content": [{ "type": "text", "text": turn.content }],
        }));
    }

    for _ in 0..MAX_TOOL_ROUNDS {
        let body = json!({
            "model": api_model,
            "max_tokens": 4096,
            "system": workspace_system_prompt(policy),
            "tools": tools,
            "messages": api_messages,
        });

        let res = client
            .post(&url)
            .header("x-api-key", key.as_str())
            .header("anthropic-version", "2023-06-01")
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| provider_error(Provider::Anthropic, "request failed", &e.to_string()))?;

        let status = res.status();
        let data: serde_json::Value = res
            .json()
            .await
            .map_err(|e| provider_error(Provider::Anthropic, "invalid response", &e.to_string()))?;

        if !status.is_success() {
            let detail = data["error"]["message"].as_str().unwrap_or("Unknown error");
            return Err(provider_error(
                Provider::Anthropic,
                &format!("HTTP {status}"),
                detail,
            ));
        }

        let blocks = data["content"].as_array().cloned().unwrap_or_default();
        let mut tool_uses: Vec<(String, String, String)> = Vec::new();
        let mut text_parts: Vec<String> = Vec::new();

        for block in &blocks {
            match block["type"].as_str() {
                Some("text") => {
                    if let Some(t) = block["text"].as_str() {
                        text_parts.push(t.to_string());
                    }
                }
                Some("tool_use") => {
                    let id = block["id"].as_str().unwrap_or("").to_string();
                    let name = block["name"].as_str().unwrap_or("").to_string();
                    let args = serde_json::to_string(&block["input"]).unwrap_or_else(|_| "{}".to_string());
                    tool_uses.push((id, name, args));
                }
                _ => {}
            }
        }

        api_messages.push(json!({ "role": "assistant", "content": blocks }));

        if !tool_uses.is_empty() {
            let mut results: Vec<serde_json::Value> = Vec::new();
            for (id, name, args) in tool_uses {
                let out = run_tool(policy, &name, &args);
                results.push(json!({
                    "type": "tool_result",
                    "tool_use_id": id,
                    "content": out,
                }));
            }
            api_messages.push(json!({ "role": "user", "content": results }));
            continue;
        }

        let joined = text_parts.join("");
        if !joined.trim().is_empty() {
            return Ok(joined);
        }

        return Err(provider_error(
            Provider::Anthropic,
            "response",
            "empty assistant message",
        ));
    }

    Err("Anthropic: stopped after too many tool rounds.".to_string())
}

fn gemini_tool_declarations() -> serde_json::Value {
    json!([{
        "function_declarations": [
            {
                "name": "read_file",
                "description": "Read a UTF-8 text file under AI-enabled paths. Prefer over guessing when the task depends on real project contents.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" }
                    },
                    "required": ["path"]
                }
            },
            {
                "name": "write_file",
                "description": "Create or overwrite a UTF-8 text file under AI-enabled paths. Use to save edits or new files; read first when needed for safe changes.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" },
                        "content": { "type": "string" }
                    },
                    "required": ["path", "content"]
                }
            },
            {
                "name": "list_directory",
                "description": "List files and subfolders under an AI-enabled directory. Use to discover which files to read.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" }
                    },
                    "required": ["path"]
                }
            },
            {
                "name": "remove_path",
                "description": "Permanently delete a file or folder (recursive). Use when the user asks to delete files or folders.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" }
                    },
                    "required": ["path"]
                }
            },
            {
                "name": "clear_directory",
                "description": "Delete all contents inside a directory but keep the directory. Use to empty or clear a folder.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" }
                    },
                    "required": ["path"]
                }
            }
        ]
    }])
}

async fn complete_gemini(
    api_model: &str,
    messages: &[ChatTurn],
    system: Option<&str>,
) -> Result<String, String> {
    let key = api_key(Provider::Google).expect("key checked");
    let base = base_url(
        Provider::Google,
        "https://generativelanguage.googleapis.com/v1beta",
    );
    let url = format!(
        "{}/models/{}:generateContent?key={}",
        base.trim_end_matches('/'),
        api_model,
        key
    );

    let mut contents: Vec<serde_json::Value> = Vec::new();
    for turn in messages {
        let role = if turn.role == "assistant" {
            "model"
        } else {
            "user"
        };
        contents.push(json!({
            "role": role,
            "parts": [{ "text": turn.content }],
        }));
    }

    let mut body = json!({ "contents": contents });
    if let Some(sys) = system {
        body["systemInstruction"] = json!({
            "parts": [{ "text": sys }],
        });
    }

    let client = http_client()?;
    let res = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| provider_error(Provider::Google, "request failed", &e.to_string()))?;

    let status = res.status();
    let data: serde_json::Value = res
        .json()
        .await
        .map_err(|e| provider_error(Provider::Google, "invalid response", &e.to_string()))?;

    if !status.is_success() {
        let detail = data["error"]["message"].as_str().unwrap_or("Unknown error");
        return Err(provider_error(
            Provider::Google,
            &format!("HTTP {status}"),
            detail,
        ));
    }

    data["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| {
            provider_error(Provider::Google, "response", "missing message content")
        })
}

async fn gemini_agent_loop(
    api_model: &str,
    chat_messages: &[ChatTurn],
    policy: &WorkspacePolicy,
) -> Result<String, String> {
    let key = api_key(Provider::Google).expect("key checked");
    let base = base_url(
        Provider::Google,
        "https://generativelanguage.googleapis.com/v1beta",
    );
    let url = format!(
        "{}/models/{}:generateContent?key={}",
        base.trim_end_matches('/'),
        api_model,
        key
    );
    let client = http_client()?;

    let mut contents: Vec<serde_json::Value> = Vec::new();
    for turn in chat_messages {
        let role = if turn.role == "assistant" {
            "model"
        } else {
            "user"
        };
        contents.push(json!({
            "role": role,
            "parts": [{ "text": turn.content }],
        }));
    }

    for _ in 0..MAX_TOOL_ROUNDS {
        let body = json!({
            "contents": contents,
            "systemInstruction": {
                "parts": [{ "text": workspace_system_prompt(policy) }],
            },
            "tools": gemini_tool_declarations(),
        });

        let res = client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| provider_error(Provider::Google, "request failed", &e.to_string()))?;

        let status = res.status();
        let data: serde_json::Value = res
            .json()
            .await
            .map_err(|e| provider_error(Provider::Google, "invalid response", &e.to_string()))?;

        if !status.is_success() {
            let detail = data["error"]["message"].as_str().unwrap_or("Unknown error");
            return Err(provider_error(
                Provider::Google,
                &format!("HTTP {status}"),
                detail,
            ));
        }

        let parts = data["candidates"][0]["content"]["parts"]
            .as_array()
            .cloned()
            .unwrap_or_default();

        let mut function_calls: Vec<(String, serde_json::Value)> = Vec::new();
        let mut text_out: Option<String> = None;

        for part in &parts {
            if let Some(fc) = part.get("functionCall") {
                let name = fc["name"].as_str().unwrap_or("").to_string();
                let args = fc["args"].clone();
                function_calls.push((name, args));
            } else if let Some(t) = part.get("text").and_then(|x| x.as_str()) {
                text_out = Some(
                    text_out
                        .map(|o| format!("{o}{t}"))
                        .unwrap_or_else(|| t.to_string()),
                );
            }
        }

        contents.push(json!({ "role": "model", "parts": parts }));

        if !function_calls.is_empty() {
            let mut response_parts: Vec<serde_json::Value> = Vec::new();
            for (name, args_val) in function_calls {
                let args_str = serde_json::to_string(&args_val).unwrap_or_else(|_| "{}".to_string());
                let out = run_tool(policy, &name, &args_str);
                response_parts.push(json!({
                    "functionResponse": {
                        "name": name,
                        "response": { "result": out }
                    }
                }));
            }
            contents.push(json!({ "role": "user", "parts": response_parts }));
            continue;
        }

        return text_out.filter(|s| !s.trim().is_empty()).ok_or_else(|| {
            provider_error(Provider::Google, "response", "empty assistant message")
        });
    }

    Err("Gemini: stopped after too many tool rounds.".to_string())
}

async fn complete_for_model(
    model_id: &str,
    messages: &[ChatTurn],
    system: Option<&str>,
) -> Result<String, String> {
    let (provider, api_model) = resolve_api_model(model_id)?;
    match provider {
        Provider::OpenAi => complete_openai(&api_model, messages, system).await,
        Provider::Anthropic => complete_anthropic(&api_model, messages, system).await,
        Provider::Google => complete_gemini(&api_model, messages, system).await,
        Provider::DeepSeek => complete_deepseek(&api_model, messages, system).await,
    }
}

async fn complete_for_model_with_workspace(
    model_id: &str,
    messages: &[ChatTurn],
    policy: &WorkspacePolicy,
) -> Result<String, String> {
    let (provider, api_model) = resolve_api_model(model_id)?;
    if !model_supports_tools(model_id) {
        let sys = Some(workspace_system_prompt(policy));
        return complete_for_model(model_id, messages, sys.as_deref()).await;
    }
    match provider {
        Provider::OpenAi => openai_agent_loop(&api_model, messages, policy).await,
        Provider::Anthropic => anthropic_agent_loop(&api_model, messages, policy).await,
        Provider::Google => gemini_agent_loop(&api_model, messages, policy).await,
        Provider::DeepSeek => deepseek_agent_loop(&api_model, messages, policy).await,
    }
}

#[tauri::command]
pub async fn ai_chat_complete(
    model_id: String,
    messages: Vec<ChatTurn>,
    workspace: Option<AiWorkspace>,
    system: Option<String>,
) -> Result<String, String> {
    if messages.is_empty() {
        return Err("No messages to send.".to_string());
    }
    if let Some(ws) = workspace.as_ref() {
        if let Some(policy) = WorkspacePolicy::from_workspace(ws) {
            return complete_for_model_with_workspace(&model_id, &messages, &policy).await;
        }
    }
    let sys = chat_system_prompt(system.as_deref());
    complete_for_model(&model_id, &messages, Some(sys.as_str())).await
}

#[tauri::command]
pub async fn ai_chat_synthesize(
    user_message: String,
    model_responses: Vec<ModelResponse>,
) -> Result<String, String> {
    if model_responses.is_empty() {
        return Err("No model responses to synthesize.".to_string());
    }

    let mut lines = String::new();
    for entry in &model_responses {
        let label = entry
            .model_name
            .as_deref()
            .filter(|s| !s.is_empty())
            .unwrap_or(&entry.model_id);
        lines.push_str(&format!("### {label}\n{}\n\n", entry.content));
    }

    let system = "You synthesize multiple AI assistant answers into one clear, unified reply. \
Incorporate the strongest points; avoid repeating the same idea. Do not mention round tables \
or that you are merging sources unless the user asked for that process. \
When the merged answer includes code, use fenced markdown code blocks with a language tag (e.g. ```python).";

    let user_prompt = format!(
        "User message:\n{user_message}\n\nAssistant responses to merge:\n{lines}\n\
Write one cohesive answer for the user."
    );

    let messages = vec![ChatTurn {
        role: "user".to_string(),
        content: user_prompt,
    }];

    let (provider, _) = default_synthesis_provider().ok_or_else(|| {
        "No AI API keys configured. Add OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, or DEEPSEEK_API_KEY to .env.".to_string()
    })?;

    let model_id = match provider {
        Provider::OpenAi => "gpt4o",
        Provider::Anthropic => "claude",
        Provider::Google => "gemini",
        Provider::DeepSeek => "deepseek",
    };

    complete_for_model(model_id, &messages, Some(system)).await
}
