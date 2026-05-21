use crate::ai_config::{
    api_key, base_url, resolve_api_model, synthesis_provider_for_models, validate_base_url,
    Provider,
};
use crate::xai_models::{
    default_account_chat_model, invalidate_cache, is_model_not_found_error, resolve_runtime_model,
};
use crate::ai_workspace::{
    tool_clear_directory, tool_list_directory, tool_read_file, tool_remove_path, tool_write_file,
    AiWorkspace, ClearDirectoryResult, RemovePathResult, WorkspacePolicy, WriteFileResult,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::Emitter;

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
        Provider::Xai => "xAI",
    };
    format!("{name} {context}: {detail}")
}

fn extract_error_detail(data: &serde_json::Value, raw: &str) -> String {
    data["error"]["message"]
        .as_str()
        .or_else(|| data["error"]["error"].as_str())
        .or_else(|| data["error"]["detail"].as_str())
        .or_else(|| data["error"]["type"].as_str())
        .or_else(|| data["message"].as_str())
        .or_else(|| data["detail"].as_str())
        .or_else(|| data["error"].as_str())
        .or_else(|| {
            let trimmed = raw.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        })
        .unwrap_or("Unknown error")
        .to_string()
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

const RESPONSE_STYLE_GUIDANCE: &str = "\n\
Response style contract:\n\
- Format responses in a modern, highly readable developer-tool UI style.\n\
- Use clear section headers frequently; prefer structured layouts over plain prose.\n\
- Keep spacing clean and breathable, avoid large walls of text, and keep paragraphs short (1-3 lines).\n\
- Use bullet points whenever information can be grouped or scanned.\n\
- Use strong visual hierarchy: title, section headers, bullets, sub-bullets, and small notes where useful.\n\
- Highlight important keywords, warnings, filenames, commands, and core concepts with markdown bold.\n\
- Use inline code formatting for technical terms, APIs, functions, variables, file paths, and commands.\n\
- Convert comparisons into compact markdown tables when useful.\n\
- For longer answers, start with concise key takeaways.\n\
- Keep tone technical, modern, minimal, and polished; reduce filler words.\n\
\n\
Technical depth contract:\n\
- Assume the user is technically literate unless they explicitly ask for simplification.\n\
- Prefer precise engineering terminology over consumer wording.\n\
- Explain architecture, trade-offs, implementation details, and runtime behavior when relevant.\n\
- Include scalability, performance, maintainability, memory, latency, and developer experience implications when useful.\n\
- Reference concrete engineering concepts naturally (APIs, state management, concurrency, async flows, caching, indexing, retrieval pipelines, data structures, event systems, orchestration, rendering pipelines, distributed systems, dependency graphs, serialization, networking).\n\
- Favor implementation-oriented guidance, production patterns, and explicit alternatives.\n\
- Call out edge cases, constraints, and failure modes when materially relevant.\n\
- Do not oversimplify or provide generic best-practices without context.\n";

const UI_PANE_GUIDANCE: &str = "\n\
UI pane controls:\n\
- If the user explicitly asks you to open or close a UI pane, include one directive token on its own line using this exact format: [[FORGE_PANE action=\"open|close\" target=\"terminal|websites|models|workflow|right-sidebar|explorer|agent-cart\"]]\n\
- You may include multiple directive lines if the user asked for multiple pane changes.\n\
- Keep your normal conversational response in plain text around the directive lines.\n\
- Do not output pane directives unless the user asked to change panes.\n";

const DEFAULT_CHAT_SYSTEM: &str =
    "You are a helpful assistant in a multi-model AI workspace.";

fn chat_system_prompt(user: Option<&str>) -> String {
    match user.map(str::trim).filter(|s| !s.is_empty()) {
        Some(custom) => format!(
            "{custom}{RESPONSE_STYLE_GUIDANCE}{CODE_FORMATTING_GUIDANCE}{UI_PANE_GUIDANCE}"
        ),
        None => format!(
            "{DEFAULT_CHAT_SYSTEM}{RESPONSE_STYLE_GUIDANCE}{CODE_FORMATTING_GUIDANCE}{UI_PANE_GUIDANCE}"
        ),
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
- Use absolute paths exactly as they appear on disk.{RESPONSE_STYLE_GUIDANCE}{CODE_FORMATTING_GUIDANCE}{UI_PANE_GUIDANCE}",
        policy.roots_summary()
    )
}

fn synthesis_system_prompt(user: Option<&str>) -> String {
    const DEFAULT_SYNTHESIS_SYSTEM: &str = "You synthesize multiple AI assistant answers into one clear, unified reply. \
Incorporate the strongest points; avoid repeating the same idea. Do not mention round tables \
or that you are merging sources unless the user asked for that process.";

    match user.map(str::trim).filter(|s| !s.is_empty()) {
        Some(custom) => format!("{custom}{RESPONSE_STYLE_GUIDANCE}{CODE_FORMATTING_GUIDANCE}"),
        None => format!(
            "{DEFAULT_SYNTHESIS_SYSTEM}{RESPONSE_STYLE_GUIDANCE}{CODE_FORMATTING_GUIDANCE}"
        ),
    }
}

#[derive(Debug, Clone)]
struct ToolActivity {
    action: String,
    path: String,
    added: Option<usize>,
    removed: Option<usize>,
}

#[derive(Debug, Clone)]
struct ToolExecution {
    output: String,
    activity: Option<ToolActivity>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ToolActivityEvent {
    stream_id: String,
    action: String,
    path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    added: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    removed: Option<usize>,
}

#[derive(Debug, Clone)]
struct ToolActivitySink {
    app: tauri::AppHandle,
    stream_id: String,
}

impl ToolActivitySink {
    fn new(app: tauri::AppHandle, stream_id: String) -> Self {
        Self { app, stream_id }
    }

    fn emit(&self, activity: &ToolActivity) {
        let payload = ToolActivityEvent {
            stream_id: self.stream_id.clone(),
            action: activity.action.clone(),
            path: activity.path.clone(),
            added: activity.added,
            removed: activity.removed,
        };
        let _ = self.app.emit("ai-tool-activity", payload);
    }
}

fn with_tool_activity(content: String, activities: &[ToolActivity]) -> String {
    if activities.is_empty() {
        return content;
    }
    let directives = activities
        .iter()
        .map(|activity| {
            let mut payload = json!({
                "action": activity.action,
                "path": activity.path,
            });
            if let Some(added) = activity.added {
                payload["added"] = json!(added);
            }
            if let Some(removed) = activity.removed {
                payload["removed"] = json!(removed);
            }
            format!("[[FORGE_ACTIVITY {}]]", payload)
        })
        .collect::<Vec<_>>()
        .join("\n");
    if content.trim().is_empty() {
        directives
    } else {
        format!("{directives}\n{content}")
    }
}

fn run_tool(
    policy: &WorkspacePolicy,
    name: &str,
    args: &str,
    activity_sink: Option<&ToolActivitySink>,
) -> ToolExecution {
    let result = (|| -> Result<ToolExecution, String> {
        let v: serde_json::Value =
            serde_json::from_str(args).map_err(|e| format!("Invalid tool arguments JSON: {e}"))?;
        match name {
            "read_file" => {
                let path = v["path"]
                    .as_str()
                    .ok_or_else(|| "read_file: missing path".to_string())?;
                let output = tool_read_file(policy, path)?;
                Ok(ToolExecution {
                    output,
                    activity: Some(ToolActivity {
                        action: "read".to_string(),
                        path: path.to_string(),
                        added: None,
                        removed: None,
                    }),
                })
            }
            "write_file" => {
                let path = v["path"]
                    .as_str()
                    .ok_or_else(|| "write_file: missing path".to_string())?;
                let content = v["content"].as_str().unwrap_or("");
                let result: WriteFileResult = tool_write_file(policy, path, content)?;
                Ok(ToolExecution {
                    output: result.message,
                    activity: Some(ToolActivity {
                        action: "write".to_string(),
                        path: path.to_string(),
                        added: Some(result.added_lines),
                        removed: Some(result.removed_lines),
                    }),
                })
            }
            "list_directory" | "list_dir" => {
                let path = v["path"]
                    .as_str()
                    .ok_or_else(|| "list_directory: missing path".to_string())?;
                let output = tool_list_directory(policy, path)?;
                Ok(ToolExecution {
                    output,
                    activity: None,
                })
            }
            "remove_path" | "delete_path" | "delete_file" | "remove_file" => {
                let path = v["path"]
                    .as_str()
                    .ok_or_else(|| "remove_path: missing path".to_string())?;
                let result: RemovePathResult = tool_remove_path(policy, path)?;
                Ok(ToolExecution {
                    output: result.message,
                    activity: Some(ToolActivity {
                        action: "write".to_string(),
                        path: path.to_string(),
                        added: Some(0),
                        removed: Some(result.removed_lines),
                    }),
                })
            }
            "clear_directory" | "empty_directory" => {
                let path = v["path"]
                    .as_str()
                    .ok_or_else(|| "clear_directory: missing path".to_string())?;
                let result: ClearDirectoryResult = tool_clear_directory(policy, path)?;
                Ok(ToolExecution {
                    output: result.message,
                    activity: Some(ToolActivity {
                        action: "write".to_string(),
                        path: path.to_string(),
                        added: Some(0),
                        removed: Some(result.removed_lines),
                    }),
                })
            }
            _ => Err(format!("Unknown tool: {name}")),
        }
    })();
    match result {
        Ok(exec) => {
            if let Some(activity) = exec.activity.as_ref() {
                if let Some(sink) = activity_sink {
                    sink.emit(activity);
                }
            }
            exec
        }
        Err(e) => ToolExecution {
            output: format!("ERROR: {e}"),
            activity: None,
        },
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
    validate_base_url(Provider::OpenAi, &base)?;
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
    activity_sink: Option<ToolActivitySink>,
) -> Result<String, String> {
    let key = api_key(Provider::OpenAi).expect("key checked");
    let base = base_url(Provider::OpenAi, "https://api.openai.com/v1");
    validate_base_url(Provider::OpenAi, &base)?;
    let url = format!("{}/chat/completions", base.trim_end_matches('/'));
    let client = http_client()?;
    let tools = tools_schema_openai();

    let mut api_messages: Vec<serde_json::Value> = vec![json!({
        "role": "system",
        "content": workspace_system_prompt(policy),
    })];
    let mut activities: Vec<ToolActivity> = Vec::new();
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
                    let output = run_tool(policy, name, args, activity_sink.as_ref());
                    if let Some(activity) = output.activity {
                        activities.push(activity);
                    }
                    api_messages.push(json!({
                        "role": "tool",
                        "tool_call_id": id,
                        "content": output.output,
                    }));
                }
                continue;
            }
        }

        return msg["content"]
            .as_str()
            .map(|s| with_tool_activity(s.to_string(), &activities))
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
    validate_base_url(Provider::DeepSeek, &base)?;
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
    activity_sink: Option<ToolActivitySink>,
) -> Result<String, String> {
    let key = api_key(Provider::DeepSeek).expect("key checked");
    let base = base_url(Provider::DeepSeek, "https://api.deepseek.com/v1");
    validate_base_url(Provider::DeepSeek, &base)?;
    let url = format!("{}/chat/completions", base.trim_end_matches('/'));
    let client = http_client()?;
    let tools = tools_schema_openai();

    let mut api_messages: Vec<serde_json::Value> = vec![json!({
        "role": "system",
        "content": workspace_system_prompt(policy),
    })];
    let mut activities: Vec<ToolActivity> = Vec::new();
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
                    let output = run_tool(policy, name, args, activity_sink.as_ref());
                    if let Some(activity) = output.activity {
                        activities.push(activity);
                    }
                    api_messages.push(json!({
                        "role": "tool",
                        "tool_call_id": id,
                        "content": output.output,
                    }));
                }
                continue;
            }
        }

        return msg["content"]
            .as_str()
            .map(|s| with_tool_activity(s.to_string(), &activities))
            .filter(|s| !s.trim().is_empty())
            .ok_or_else(|| {
                provider_error(Provider::DeepSeek, "response", "empty assistant message")
            });
    }

    Err("DeepSeek: stopped after too many tool rounds (possible loop).".to_string())
}

async fn complete_xai_once(
    api_model: &str,
    messages: &[ChatTurn],
    system: Option<&str>,
) -> Result<String, String> {
    let key = api_key(Provider::Xai).expect("key checked");
    let base = base_url(Provider::Xai, "https://api.x.ai/v1");
    validate_base_url(Provider::Xai, &base)?;
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
        .map_err(|e| provider_error(Provider::Xai, "request failed", &e.to_string()))?;

    let status = res.status();
    let raw = res
        .text()
        .await
        .map_err(|e| provider_error(Provider::Xai, "invalid response", &e.to_string()))?;
    let data: serde_json::Value = serde_json::from_str(&raw).unwrap_or_else(|_| json!({}));

    if !status.is_success() {
        let detail = extract_error_detail(&data, &raw);
        return Err(provider_error(
            Provider::Xai,
            &format!("HTTP {status}"),
            &detail,
        ));
    }

    data["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| provider_error(Provider::Xai, "response", "missing message content"))
}

async fn complete_xai(
    api_model: &str,
    messages: &[ChatTurn],
    system: Option<&str>,
) -> Result<String, String> {
    let api_model = resolve_runtime_model(api_model).await;
    match complete_xai_once(&api_model, messages, system).await {
        Ok(content) => Ok(content),
        Err(err) if is_model_not_found_error(&err) => {
            invalidate_cache();
            let fallback = default_account_chat_model().await;
            if fallback == api_model {
                return Err(err);
            }
            complete_xai_once(&fallback, messages, system).await
        }
        Err(err) => Err(err),
    }
}

async fn xai_agent_loop_once(
    api_model: &str,
    chat_messages: &[ChatTurn],
    policy: &WorkspacePolicy,
    activity_sink: Option<ToolActivitySink>,
) -> Result<String, String> {
    let key = api_key(Provider::Xai).expect("key checked");
    let base = base_url(Provider::Xai, "https://api.x.ai/v1");
    validate_base_url(Provider::Xai, &base)?;
    let url = format!("{}/chat/completions", base.trim_end_matches('/'));
    let client = http_client()?;
    let tools = tools_schema_openai();

    let mut api_messages: Vec<serde_json::Value> = vec![json!({
        "role": "system",
        "content": workspace_system_prompt(policy),
    })];
    let mut activities: Vec<ToolActivity> = Vec::new();
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
            .map_err(|e| provider_error(Provider::Xai, "request failed", &e.to_string()))?;

        let status = res.status();
        let raw = res
            .text()
            .await
            .map_err(|e| provider_error(Provider::Xai, "invalid response", &e.to_string()))?;
        let data: serde_json::Value = serde_json::from_str(&raw).unwrap_or_else(|_| json!({}));

        if !status.is_success() {
            let detail = extract_error_detail(&data, &raw);
            return Err(provider_error(
                Provider::Xai,
                &format!("HTTP {status}"),
                &detail,
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
                    let output = run_tool(policy, name, args, activity_sink.as_ref());
                    if let Some(activity) = output.activity {
                        activities.push(activity);
                    }
                    api_messages.push(json!({
                        "role": "tool",
                        "tool_call_id": id,
                        "content": output.output,
                    }));
                }
                continue;
            }
        }

        return msg["content"]
            .as_str()
            .map(|s| with_tool_activity(s.to_string(), &activities))
            .filter(|s| !s.trim().is_empty())
            .ok_or_else(|| provider_error(Provider::Xai, "response", "empty assistant message"));
    }

    Err("xAI: stopped after too many tool rounds (possible loop).".to_string())
}

async fn xai_agent_loop(
    api_model: &str,
    chat_messages: &[ChatTurn],
    policy: &WorkspacePolicy,
    activity_sink: Option<ToolActivitySink>,
) -> Result<String, String> {
    let api_model = resolve_runtime_model(api_model).await;
    match xai_agent_loop_once(&api_model, chat_messages, policy, activity_sink.clone()).await {
        Ok(content) => Ok(content),
        Err(err) if is_model_not_found_error(&err) => {
            invalidate_cache();
            let fallback = default_account_chat_model().await;
            if fallback == api_model {
                return Err(err);
            }
            xai_agent_loop_once(&fallback, chat_messages, policy, activity_sink).await
        }
        Err(err) => Err(err),
    }
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
    validate_base_url(Provider::Anthropic, &base)?;
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
    activity_sink: Option<ToolActivitySink>,
) -> Result<String, String> {
    let key = api_key(Provider::Anthropic).expect("key checked");
    let base = base_url(Provider::Anthropic, "https://api.anthropic.com");
    validate_base_url(Provider::Anthropic, &base)?;
    let url = format!("{}/v1/messages", base.trim_end_matches('/'));
    let client = http_client()?;
    let tools = anthropic_tools();

    let mut api_messages: Vec<serde_json::Value> = Vec::new();
    let mut activities: Vec<ToolActivity> = Vec::new();
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
                let out = run_tool(policy, &name, &args, activity_sink.as_ref());
                if let Some(activity) = out.activity {
                    activities.push(activity);
                }
                results.push(json!({
                    "type": "tool_result",
                    "tool_use_id": id,
                    "content": out.output,
                }));
            }
            api_messages.push(json!({ "role": "user", "content": results }));
            continue;
        }

        let joined = text_parts.join("");
        if !joined.trim().is_empty() {
            return Ok(with_tool_activity(joined, &activities));
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
    validate_base_url(Provider::Google, &base)?;
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
    activity_sink: Option<ToolActivitySink>,
) -> Result<String, String> {
    let key = api_key(Provider::Google).expect("key checked");
    let base = base_url(
        Provider::Google,
        "https://generativelanguage.googleapis.com/v1beta",
    );
    validate_base_url(Provider::Google, &base)?;
    let url = format!(
        "{}/models/{}:generateContent?key={}",
        base.trim_end_matches('/'),
        api_model,
        key
    );
    let client = http_client()?;
    let mut activities: Vec<ToolActivity> = Vec::new();

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
                let out = run_tool(policy, &name, &args_str, activity_sink.as_ref());
                if let Some(activity) = out.activity {
                    activities.push(activity);
                }
                response_parts.push(json!({
                    "functionResponse": {
                        "name": name,
                        "response": { "result": out.output }
                    }
                }));
            }
            contents.push(json!({ "role": "user", "parts": response_parts }));
            continue;
        }

        return text_out
            .map(|s| with_tool_activity(s, &activities))
            .filter(|s| !s.trim().is_empty())
            .ok_or_else(|| provider_error(Provider::Google, "response", "empty assistant message"));
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
        Provider::Xai => complete_xai(&api_model, messages, system).await,
    }
}

async fn complete_for_model_with_workspace(
    model_id: &str,
    messages: &[ChatTurn],
    policy: &WorkspacePolicy,
    activity_sink: Option<ToolActivitySink>,
) -> Result<String, String> {
    let (provider, api_model) = resolve_api_model(model_id)?;
    if !model_supports_tools(model_id) {
        let sys = Some(workspace_system_prompt(policy));
        return complete_for_model(model_id, messages, sys.as_deref()).await;
    }
    match provider {
        Provider::OpenAi => openai_agent_loop(&api_model, messages, policy, activity_sink).await,
        Provider::Anthropic => anthropic_agent_loop(&api_model, messages, policy, activity_sink).await,
        Provider::Google => gemini_agent_loop(&api_model, messages, policy, activity_sink).await,
        Provider::DeepSeek => deepseek_agent_loop(&api_model, messages, policy, activity_sink).await,
        Provider::Xai => xai_agent_loop(&api_model, messages, policy, activity_sink).await,
    }
}

#[tauri::command]
pub async fn ai_chat_complete(
    app: tauri::AppHandle,
    model_id: String,
    messages: Vec<ChatTurn>,
    workspace: Option<AiWorkspace>,
    system: Option<String>,
    stream_id: Option<String>,
) -> Result<String, String> {
    if messages.is_empty() {
        return Err("No messages to send.".to_string());
    }
    if let Some(ws) = workspace.as_ref() {
        if let Some(policy) = WorkspacePolicy::from_workspace(ws) {
            let activity_sink = stream_id
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(|id| ToolActivitySink::new(app.clone(), id.to_string()));
            return complete_for_model_with_workspace(
                &model_id,
                &messages,
                &policy,
                activity_sink,
            )
            .await;
        }
    }
    let sys = chat_system_prompt(system.as_deref());
    complete_for_model(&model_id, &messages, Some(sys.as_str())).await
}

#[tauri::command]
pub async fn ai_chat_synthesize(
    user_message: String,
    model_responses: Vec<ModelResponse>,
    system: Option<String>,
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

    let synthesis_system = synthesis_system_prompt(system.as_deref());

    let user_prompt = format!(
        "User message:\n{user_message}\n\nAssistant responses to merge:\n{lines}\n\
Write one cohesive answer for the user."
    );

    let messages = vec![ChatTurn {
        role: "user".to_string(),
        content: user_prompt,
    }];

    let participant_ids: Vec<&str> = model_responses
        .iter()
        .map(|entry| entry.model_id.as_str())
        .collect();

    let (provider, _) = synthesis_provider_for_models(&participant_ids).ok_or_else(|| {
        "No AI provider credentials are configured. Set FORGE_BACKEND_URL for managed mode, or add OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, DEEPSEEK_API_KEY, or GROK_API_KEY to .env.".to_string()
    })?;

    let model_id = match provider {
        Provider::OpenAi => "gpt4o",
        Provider::Anthropic => "claude",
        Provider::Google => "gemini",
        Provider::DeepSeek => "deepseek",
        Provider::Xai => "grok",
    };

    complete_for_model(model_id, &messages, Some(synthesis_system.as_str())).await
}
