use crate::agent_context::{
    anthropic_cached_system, anthropic_cached_tools, cap_tool_output,
    compact_anthropic_messages, compact_gemini_contents, compact_openai_messages,
    continuation_preserve_prefix,
};
use crate::ai_config::{
    api_key, base_url, has_managed_backend, resolve_api_model, synthesis_provider_for_models,
    validate_base_url, Provider,
};
use crate::xai_models::{
    default_account_chat_model, invalidate_cache, is_model_not_found_error, resolve_runtime_model,
};
use crate::ai_workspace::{
    tool_clear_directory, tool_list_directory, tool_read_file, tool_remove_path,
    tool_search_replace, tool_write_file,
    AiWorkspace, ClearDirectoryResult, RemovePathResult, WorkspacePolicy, WriteFileResult,
};
use crate::git::{
    git_clone, git_commit, git_fetch, git_init, git_pull, git_push, git_restore_paths, git_status,
    GitStatusResult,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use tauri::Emitter;

const FORGE_USER_AGENT: &str = "FORGE/2.0 (Tauri)";
/// Max tool rounds per agent run (or per Continue resume).
const MAX_TOOL_ROUNDS: u32 = 50;
/// Start watching for repeated tool calls after this round.
const LOOP_DETECTION_START_ROUND: u32 = 20;
/// Stop when the same tool signature repeats this many times.
const LOOP_REPEAT_THRESHOLD: u32 = 3;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentContinuationState {
    provider: String,
    api_model: String,
    round: u32,
    messages: Vec<serde_json::Value>,
}

struct LoopTracker {
    round: u32,
    signature_counts: HashMap<String, u32>,
}

impl LoopTracker {
    fn new(start_round: u32) -> Self {
        Self {
            round: start_round,
            signature_counts: HashMap::new(),
        }
    }

    fn advance(&mut self) -> u32 {
        self.round += 1;
        self.round
    }

    fn round(&self) -> u32 {
        self.round
    }

    fn check_stuck(&mut self, signatures: &[String]) -> Option<&'static str> {
        if self.round < LOOP_DETECTION_START_ROUND {
            return None;
        }
        for signature in signatures {
            let count = self.signature_counts.entry(signature.clone()).or_insert(0);
            *count += 1;
            if *count >= LOOP_REPEAT_THRESHOLD {
                return Some("Repeated the same tool action too many times");
            }
        }
        None
    }
}

fn tool_signature(name: &str, args: &str) -> String {
    let value: serde_json::Value = serde_json::from_str(args).unwrap_or(json!({}));
    let key = value
        .get("path")
        .and_then(|entry| entry.as_str())
        .or_else(|| value.get("message").and_then(|entry| entry.as_str()))
        .or_else(|| value.get("url").and_then(|entry| entry.as_str()))
        .unwrap_or("");
    format!("{name}:{key}")
}

fn tool_signatures_from_json_args(calls: &[(String, String)]) -> Vec<String> {
    calls
        .iter()
        .map(|(name, args)| tool_signature(name, args))
        .collect()
}

fn parse_agent_continuation(raw: Option<String>) -> Result<Option<AgentContinuationState>, String> {
    let Some(raw) = raw else {
        return Ok(None);
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    serde_json::from_str(trimmed)
        .map(Some)
        .map_err(|e| format!("Invalid agent continuation payload: {e}"))
}

/// Strip embedded agent continuation payloads from chat history so they are not
/// re-billed on the next user message.
fn sanitize_chat_history_content(content: &str) -> String {
    const MARKER: &str = "[[FORGE_AGENT_CONTINUE";
    if let Some(index) = content.rfind(MARKER) {
        return content[..index].trim().to_string();
    }
    content.trim().to_string()
}

fn provider_agent_key(provider: Provider) -> &'static str {
    match provider {
        Provider::OpenAi => "openai",
        Provider::Anthropic => "anthropic",
        Provider::Google => "google",
        Provider::DeepSeek => "deepseek",
        Provider::Xai => "xai",
    }
}

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

fn provider_http_error(provider: Provider, url: &str, err: reqwest::Error) -> String {
    if err.is_builder() {
        let hint = if has_managed_backend() {
            "Set FORGE_BACKEND_URL to your full Render URL (https://your-app.onrender.com) and FORGE_BACKEND_TOKEN to match BACKEND_CLIENT_TOKEN, then rebuild with npm run release:beta."
        } else {
            "Check provider API keys and base URLs — remove quotes and line breaks."
        };
        return provider_error(
            provider,
            "request failed",
            &format!("Invalid URL or auth header (builder error). {hint} URL: {url}"),
        );
    }
    if err.is_connect() || err.is_request() {
        let hint = if has_managed_backend() {
            "Cannot reach the managed backend. Rebuild the installer with FORGE_BACKEND_URL set to the full URL from Render (https://NAME.onrender.com), not an internal ID."
        } else {
            "Network error reaching the provider API."
        };
        return provider_error(
            provider,
            "request failed",
            &format!("{hint} ({err}) URL: {url}"),
        );
    }
    provider_error(provider, "request failed", &err.to_string())
}

fn gemini_generate_url(base: &str, api_model: &str, key: &str) -> String {
    if has_managed_backend() {
        format!(
            "{}/models/{}:generateContent",
            base.trim_end_matches('/'),
            api_model
        )
    } else {
        format!(
            "{}/models/{}:generateContent?key={}",
            base.trim_end_matches('/'),
            api_model,
            key
        )
    }
}

fn anthropic_post(client: &reqwest::Client, url: &str, key: &str) -> reqwest::RequestBuilder {
    anthropic_post_with_cache(client, url, key, false)
}

fn anthropic_post_with_cache(
    client: &reqwest::Client,
    url: &str,
    key: &str,
    prompt_cache: bool,
) -> reqwest::RequestBuilder {
    let builder = client
        .post(url)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json");
    let builder = if prompt_cache {
        builder.header("anthropic-beta", "prompt-caching-2024-07-31")
    } else {
        builder
    };
    if has_managed_backend() {
        builder.header("Authorization", format!("Bearer {key}"))
    } else {
        builder.header("x-api-key", key)
    }
}

fn gemini_post(client: &reqwest::Client, url: &str, key: &str) -> reqwest::RequestBuilder {
    let builder = client.post(url).header("Content-Type", "application/json");
    if has_managed_backend() {
        builder.header("Authorization", format!("Bearer {key}"))
    } else {
        builder
    }
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

const GIT_TOOLS_GUIDANCE: &str = "\n\
Git/source control:\n\
- You have git tools for the active repository. When the user asks to commit, push, pull, fetch, check status, init, clone, or discard changes, call the matching tool immediately—do not ask permission or tell them to run commands manually.\n\
- For commit, call git_commit with a clear message. Use stageAll=true when the user wants every change committed.\n\
- For push/pull/fetch, call the matching git tool and report the tool result.\n\
- Only ask before destructive git operations (restore/discard) when the paths were not specified or the scope is unclear.\n";

fn append_file_tools_openai(tools: &mut Vec<serde_json::Value>, policy: &WorkspacePolicy) {
    if !policy.has_file_access() {
        return;
    }
    tools.extend([
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
    ]);
    if policy.allows_write() {
        tools.extend([
            json!({
                "type": "function",
                "function": {
                    "name": "write_file",
                    "description": "Create or overwrite a UTF-8 text file under the user's AI-enabled paths; parent dirs are created. Requires the full file body. For edits to large existing files, prefer search_replace—truncated write_file payloads are rejected.",
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
                    "name": "search_replace",
                    "description": "Replace one exact substring in an existing UTF-8 text file. Prefer this for partial edits to large files. old_string must match exactly (including whitespace). When replace_all is false, old_string must appear exactly once.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": { "type": "string", "description": "Absolute file path" },
                            "old_string": { "type": "string", "description": "Exact text to find" },
                            "new_string": { "type": "string", "description": "Replacement text" },
                            "replace_all": { "type": "boolean", "description": "Replace every occurrence (default false)" }
                        },
                        "required": ["path", "old_string", "new_string"]
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
        ]);
    }
}

fn append_git_tools_openai(tools: &mut Vec<serde_json::Value>) {
    tools.extend([
        json!({
            "type": "function",
            "function": {
                "name": "git_status",
                "description": "Show git status for the active repository (branch, ahead/behind, changed files).",
                "parameters": { "type": "object", "properties": {} }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "git_pull",
                "description": "Pull latest changes from the remote for the active repository.",
                "parameters": { "type": "object", "properties": {} }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "git_push",
                "description": "Push local commits to the remote for the active repository.",
                "parameters": { "type": "object", "properties": {} }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "git_fetch",
                "description": "Fetch from the remote without merging.",
                "parameters": { "type": "object", "properties": {} }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "git_init",
                "description": "Initialize a new git repository in the active project directory.",
                "parameters": { "type": "object", "properties": {} }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "git_commit",
                "description": "Create a git commit in the active repository.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "message": { "type": "string", "description": "Commit message" },
                        "stageAll": { "type": "boolean", "description": "Stage all changes before committing (default false)" }
                    },
                    "required": ["message"]
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "git_clone",
                "description": "Clone a remote repository into a parent directory.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "url": { "type": "string", "description": "Repository URL" },
                        "parentPath": { "type": "string", "description": "Parent directory (defaults to active repo root)" }
                    },
                    "required": ["url"]
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "git_restore_paths",
                "description": "Discard changes to tracked files and remove untracked paths.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "paths": {
                            "type": "array",
                            "items": { "type": "string" },
                            "description": "Repo-relative or absolute paths"
                        }
                    },
                    "required": ["paths"]
                }
            }
        }),
    ]);
}

/// Pane targets the agent may control, derived from per-agent permissions.
fn pane_tool_targets(policy: &WorkspacePolicy) -> Vec<&'static str> {
    let mut targets = Vec::new();
    if policy.allows_terminal_pane() {
        targets.push("terminal");
    }
    if policy.allows_browser_pane() {
        targets.push("browser");
    }
    targets
}

const OPEN_PANE_DESCRIPTION: &str = "Open (show) a FORGE workspace pane for the user. Call this immediately when the user asks to open or show the terminal or browser pane.";
const CLOSE_PANE_DESCRIPTION: &str = "Close (hide) a FORGE workspace pane for the user. Call this immediately when the user asks to close or hide the terminal or browser pane.";

fn append_pane_tools_openai(tools: &mut Vec<serde_json::Value>, policy: &WorkspacePolicy) {
    let targets = pane_tool_targets(policy);
    if targets.is_empty() {
        return;
    }
    let parameters = json!({
        "type": "object",
        "properties": {
            "target": { "type": "string", "enum": targets, "description": "Pane to act on" }
        },
        "required": ["target"]
    });
    tools.extend([
        json!({
            "type": "function",
            "function": {
                "name": "open_pane",
                "description": OPEN_PANE_DESCRIPTION,
                "parameters": parameters.clone()
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "close_pane",
                "description": CLOSE_PANE_DESCRIPTION,
                "parameters": parameters
            }
        }),
    ]);
}

fn tools_schema_openai(policy: &WorkspacePolicy) -> Vec<serde_json::Value> {
    let mut tools = Vec::new();
    append_file_tools_openai(&mut tools, policy);
    if policy.allows_git() {
        append_git_tools_openai(&mut tools);
    }
    append_pane_tools_openai(&mut tools, policy);
    tools
}

const CODE_FORMATTING_GUIDANCE: &str = "\n\
Formatting:\n\
- When sharing code, commands, or config snippets, use fenced markdown code blocks with a language tag (e.g. ```python).\n\
- Put a short plain-language intro before or after the block when helpful; keep the code itself inside the fence.\n\
- When you applied edits via tools, cite changed files by path in your summary—do not paste entire files unless the user asked to see them.\n";

const RESPONSE_STYLE_GUIDANCE: &str = "\n\
Response style contract:\n\
- After completing tool/file work, lead with a concise summary of what you did; avoid long preambles or proposal-style plans.\n\
- Use structured sections (headers, bullets) for explanations, architecture, or comparisons—not as a substitute for acting.\n\
- Keep spacing clean and breathable; avoid walls of text; keep paragraphs short (1-3 lines).\n\
- Highlight important filenames, commands, warnings, and decisions with markdown bold.\n\
- Use inline code for technical terms, APIs, functions, variables, file paths, and commands.\n\
- For longer explanatory answers, start with concise key takeaways.\n\
- Keep tone technical, calm, and direct; reduce filler and hedging.\n\
\n\
Technical depth contract:\n\
- Assume the user is technically literate unless they explicitly ask for simplification.\n\
- Prefer precise engineering terminology and concrete implementation detail over generic advice.\n\
- Explain trade-offs, edge cases, and failure modes when they materially affect the task.\n\
- Do not oversimplify or list best-practices without tying them to this project's context.\n";

const FORGE_ENGINEERING_GUIDANCE: &str = "Forge engineering standards:\n\
- Inspect existing code and match project conventions before writing.\n\
- Make the smallest correct change; no drive-by refactors or unrelated edits.\n\
- Preserve behavior unless the user explicitly requested a change.\n\
- Reuse existing modules and patterns instead of duplicating logic.\n\
- Read before inventing: use list_directory and read_file when the answer depends on the codebase.\n";

const AGENT_EXECUTION_GUIDANCE: &str = "Execution policy (act, don't ask):\n\
- When the user requests changes, fixes, improvements, or new files, perform the work in this same turn with your tools. Read what you need, then make the edits immediately.\n\
- Never end your turn with only observations, a list of suggested improvements, or an implementation plan followed by \"Would you like me to proceed?\". The user's request IS the approval to proceed.\n\
- Do not ask permission to start, continue, or finish work the user already asked for. Asking \"should I make these changes?\" when the user requested changes is a failure.\n\
- Only stop to ask a question when the request is genuinely ambiguous in a way that materially changes the outcome, or when an action is destructive beyond what was asked (e.g. deleting files the user did not mention).\n\
- Respect explicit scope limits the user states (e.g. \"don't touch desktop styles\") while still completing the in-scope work fully.\n\
- After acting, summarize what you changed and why—as a report of completed work, not a proposal.";

const UI_PANE_GUIDANCE: &str = "\n\
UI pane controls:\n\
- When the user asks to open or close a UI pane (terminal, browser, models, explorer, agent cart), emit the directive immediately on its own line: [[FORGE_PANE action=\"open|close\" target=\"terminal|websites|models|explorer|agent-cart\"]]\n\
- You may include multiple directive lines if the user asked for multiple pane changes.\n\
- Keep your normal conversational response in plain text around the directive lines.\n\
- Do not output pane directives unless the user asked to change panes.\n";

const PANE_TOOLS_GUIDANCE: &str = "\n\
Pane tools (terminal/browser):\n\
- You have open_pane and close_pane tools. When the user asks to open, show, close, or hide the terminal or browser pane, call the tool immediately—do not describe steps or emit [[FORGE_PANE]] directives for these two panes.\n\
- The tool result confirms the pane change was applied; report it briefly.\n\
- For sidebar panes (models, explorer, agent cart) keep using the [[FORGE_PANE]] directive.\n";

const DEFAULT_CHAT_SYSTEM: &str =
    "You are an agent in FORGE, an AI-native multi-agent engineering workspace. \
Users expect precise, implementation-oriented help—not generic advice or permission-seeking plans.";

fn chat_system_prompt(user: Option<&str>) -> String {
    match user.map(str::trim).filter(|s| !s.is_empty()) {
        Some(custom) => format!(
            "{custom}\n\n{FORGE_ENGINEERING_GUIDANCE}{RESPONSE_STYLE_GUIDANCE}{CODE_FORMATTING_GUIDANCE}{UI_PANE_GUIDANCE}"
        ),
        None => format!(
            "{DEFAULT_CHAT_SYSTEM}\n\n{FORGE_ENGINEERING_GUIDANCE}{RESPONSE_STYLE_GUIDANCE}{CODE_FORMATTING_GUIDANCE}{UI_PANE_GUIDANCE}"
        ),
    }
}

fn merged_workspace_system(policy: &WorkspacePolicy, user: Option<&str>) -> String {
    let workspace = workspace_system_prompt(policy);
    match user.map(str::trim).filter(|s| !s.is_empty()) {
        Some(custom) => format!("{custom}\n\n{workspace}"),
        None => workspace,
    }
}

fn workspace_system_prompt(policy: &WorkspacePolicy) -> String {
    let mut sections = Vec::new();
    if policy.has_file_access() {
        if policy.allows_write() {
            sections.push(format!(
                "The user enabled the following locations for AI file access. You have tools read_file, write_file, search_replace, list_directory, remove_path, and clear_directory to work on their real project on disk.\n\
\n\
How to work:\n\
- Whenever the request depends on this codebase (behavior, errors, structure, config, or \"what does X do\"), use list_directory and/or read_file early instead of guessing.\n\
- When the user wants changes, fixes, refactors, or new files, carry them out with write_file or search_replace in this same turn after reading what you need.\n\
- For partial edits to existing files—especially large ones like stylesheets—use search_replace instead of write_file.\n\
- When the user asks to delete files, remove folders, or empty/clear a directory, use remove_path or clear_directory—do not claim deletion without calling a tool.\n\
- To empty a folder but keep the folder itself, call clear_directory with that folder's absolute path (works even when only files inside are AI-enabled).\n\
- remove_path deletes any file, including individually AI-enabled files. It deletes subfolders recursively. Only an AI-enabled folder root itself must be cleared with clear_directory, not remove_path.\n\
- If you are unsure which file matters, list_directory near the roots below, then read the most relevant paths.\n\
\n\
Rules:\n\
- Only access paths under these AI-enabled locations (absolute paths):\n{}\n\
- Prefer read_file or list_directory before overwriting files.\n\
- write_file replaces the entire file contents; truncated payloads to large files are refused—use search_replace or include the complete file.\n\
- remove_path cannot delete an AI-enabled folder root in one step—use clear_directory on that folder instead.\n\
- Use absolute paths exactly as they appear on disk.",
                policy.roots_summary()
            ));
            sections.push(AGENT_EXECUTION_GUIDANCE.to_string());
        } else {
            sections.push(format!(
                "The user enabled read-only file access for the following locations. You have tools read_file and list_directory only—do not modify or delete files.\n\
\n\
How to work:\n\
- Whenever the request depends on this codebase (behavior, errors, structure, config, or \"what does X do\"), use list_directory and/or read_file early instead of guessing.\n\
- If the user asks for edits, explain that file write access is disabled for this agent and give precise, copy-paste-ready changes they can apply—or tell them to enable write access so you can apply edits directly.\n\
- Do not respond with only a plan or suggestions when the user asked for implementation; deliver the fullest answer you can within read-only limits.\n\
- If you are unsure which file matters, list_directory near the roots below, then read the most relevant paths.\n\
\n\
Rules:\n\
- Only access paths under these AI-enabled locations (absolute paths):\n{}\n\
- Use absolute paths exactly as they appear on disk.",
                policy.roots_summary()
            ));
        }
    }
    if policy.allows_git() {
        sections.push(format!(
            "Active git repository root: {}\n{}",
            policy.git_repo_path().unwrap_or(""),
            GIT_TOOLS_GUIDANCE.trim()
        ));
    }
    let pane_tools = if policy.allows_pane_control() {
        PANE_TOOLS_GUIDANCE
    } else {
        ""
    };
    format!(
        "{}{FORGE_ENGINEERING_GUIDANCE}{RESPONSE_STYLE_GUIDANCE}{CODE_FORMATTING_GUIDANCE}{UI_PANE_GUIDANCE}{pane_tools}",
        sections.join("\n\n")
    )
}

fn synthesis_system_prompt(user: Option<&str>) -> String {
    const DEFAULT_SYNTHESIS_SYSTEM: &str = "You synthesize multiple AI agent answers from a FORGE Round Table into one unified reply. \
Merge the strongest, most actionable points; resolve contradictions; prefer concrete implementation detail over repetition. \
Do not mention round tables, merging, or individual models unless the user asked about that process. \
If agents proposed work, present a single coherent plan or result—not a meta-discussion of who said what.";

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

    fn emit_status(&self, message: &str) {
        let trimmed = message.trim();
        if trimmed.is_empty() {
            return;
        }
        let payload = ToolActivityEvent {
            stream_id: self.stream_id.clone(),
            action: "status".to_string(),
            path: trimmed.to_string(),
            added: None,
            removed: None,
        };
        let _ = self.app.emit("ai-tool-activity", payload);
    }

    fn emit_git_refresh(&self) {
        let _ = self.app.emit("forge:git-refresh", ());
    }

    fn emit_pane_action(&self, action: &str, target: &str) {
        let _ = self.app.emit(
            "forge:pane-action",
            serde_json::json!({ "action": action, "target": target }),
        );
    }
}

fn format_git_status_summary(status: GitStatusResult) -> String {
    if !status.is_repo {
        return "Not a git repository.".to_string();
    }
    let mut lines = vec![
        format!("Branch: {}", status.branch.unwrap_or_else(|| "(unknown)".to_string())),
        format!("Ahead: {}, Behind: {}", status.ahead, status.behind),
    ];
    if status.clean {
        lines.push("Working tree clean.".to_string());
    } else {
        lines.push(format!("{} change(s):", status.changes.len()));
        for change in status.changes.iter().take(40) {
            let stage = if change.staged { "staged" } else { "unstaged" };
            lines.push(format!(
                "- {} ({stage}): {}",
                change.status, change.path
            ));
        }
        if status.changes.len() > 40 {
            lines.push(format!("…and {} more", status.changes.len() - 40));
        }
    }
    lines.join("\n")
}

fn git_repo_for_policy(policy: &WorkspacePolicy) -> Result<String, String> {
    policy
        .git_repo_path()
        .map(|s| s.to_string())
        .ok_or_else(|| {
            "No git repository is selected for this workspace. Choose one in Source Control."
                .to_string()
        })
}

fn git_tool_output(
    policy: &WorkspacePolicy,
    name: &str,
    v: &serde_json::Value,
    activity_sink: Option<&ToolActivitySink>,
) -> Result<String, String> {
    if !policy.allows_git() {
        return Err(format!("{name}: git commands are disabled for this agent"));
    }
    let repo = git_repo_for_policy(policy)?;
    let output = match name {
        "git_status" => {
            let status = git_status(repo)?;
            format_git_status_summary(status)
        }
        "git_pull" => match git_pull(repo, None)? {
            r if r.success => r.output,
            r => return Err(r.output),
        },
        "git_push" => match git_push(repo, None, None)? {
            r if r.success => r.output,
            r => return Err(r.output),
        },
        "git_fetch" => match git_fetch(repo, None)? {
            r if r.success => r.output,
            r => return Err(r.output),
        },
        "git_init" => match git_init(repo)? {
            r if r.success => r.output,
            r => return Err(r.output),
        },
        "git_commit" => {
            let message = v["message"]
                .as_str()
                .ok_or_else(|| "git_commit: missing message".to_string())?
                .trim()
                .to_string();
            if message.is_empty() {
                return Err("git_commit: message cannot be empty".to_string());
            }
            let stage_all = v["stageAll"].as_bool().unwrap_or(false);
            match git_commit(repo, message, stage_all)? {
                r if r.success => r.output,
                r => return Err(r.output),
            }
        }
        "git_clone" => {
            let url = v["url"]
                .as_str()
                .ok_or_else(|| "git_clone: missing url".to_string())?
                .trim()
                .to_string();
            let parent = v["parentPath"]
                .as_str()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string())
                .unwrap_or_else(|| repo.clone());
            match git_clone(url, parent, None)? {
                r if r.success => r.output,
                r => return Err(r.output),
            }
        }
        "git_restore_paths" => {
            let paths: Vec<String> = v["paths"]
                .as_array()
                .ok_or_else(|| "git_restore_paths: missing paths".to_string())?
                .iter()
                .filter_map(|entry| entry.as_str().map(str::trim).filter(|s| !s.is_empty()))
                .map(|s| s.to_string())
                .collect();
            if paths.is_empty() {
                return Err("git_restore_paths: paths cannot be empty".to_string());
            }
            match git_restore_paths(repo, paths)? {
                r if r.success => r.output,
                r => return Err(r.output),
            }
        }
        _ => return Err(format!("Unknown git tool: {name}")),
    };
    if let Some(sink) = activity_sink {
        sink.emit_git_refresh();
    }
    Ok(output)
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

fn summarize_tool_progress(activities: &[ToolActivity]) -> String {
    if activities.is_empty() {
        return "- No file tool actions recorded yet.".to_string();
    }
    let mut reads = 0usize;
    let mut writes = 0usize;
    let mut write_paths: Vec<&str> = Vec::new();
    for activity in activities {
        match activity.action.as_str() {
            "read" => reads += 1,
            "write" => {
                writes += 1;
                if write_paths.len() < 8 {
                    write_paths.push(activity.path.as_str());
                }
            }
            _ => {}
        }
    }
    let mut lines = vec![format!("- {reads} file read(s), {writes} file write(s)")];
    if !write_paths.is_empty() {
        lines.push("- Edited:".to_string());
        for path in write_paths {
            lines.push(format!("  - {path}"));
        }
    }
    lines.join("\n")
}

fn agent_pause_message(
    partial: &str,
    reason: &str,
    state: &AgentContinuationState,
    activities: &[ToolActivity],
) -> Result<String, String> {
    let progress = summarize_tool_progress(activities);
    let body = if partial.trim().is_empty() {
        format!(
            "I paused before finishing ({reason}).\n\n**Progress so far:**\n{progress}\n\nUse **Continue** below to resume where I left off."
        )
    } else {
        format!(
            "{partial}\n\n---\n\nI paused before finishing ({reason}).\n\n**Progress so far:**\n{progress}\n\nUse **Continue** below to resume where I left off."
        )
    };
    let mut compact_state = state.clone();
    let preserve_prefix = continuation_preserve_prefix(
        compact_state.messages.len(),
        true,
    );
    match compact_state.provider.as_str() {
        "openai" => compact_openai_messages(&mut compact_state.messages, preserve_prefix),
        "anthropic" => compact_anthropic_messages(&mut compact_state.messages, preserve_prefix),
        "google" => compact_gemini_contents(&mut compact_state.messages, preserve_prefix),
        "deepseek" => compact_openai_messages(&mut compact_state.messages, preserve_prefix),
        "xai" => compact_openai_messages(&mut compact_state.messages, preserve_prefix),
        _ => {}
    }
    let state_json = serde_json::to_string(&compact_state)
        .map_err(|e| format!("Could not serialize agent continuation: {e}"))?;
    Ok(format!(
        "{}\n[[FORGE_AGENT_CONTINUE {}]]",
        with_tool_activity(body, activities),
        state_json
    ))
}

fn emit_agent_step(activity_sink: Option<&ToolActivitySink>, round: u32) {
    if let Some(sink) = activity_sink {
        sink.emit_status(&format!("Agent step {round} — calling model"));
    }
}

/// Handle open_pane/close_pane by emitting a UI event the frontend applies.
fn run_pane_tool(
    policy: &WorkspacePolicy,
    name: &str,
    v: &serde_json::Value,
    activity_sink: Option<&ToolActivitySink>,
) -> Result<ToolExecution, String> {
    let raw_target = v["target"].as_str().unwrap_or("").trim().to_ascii_lowercase();
    let target = match raw_target.as_str() {
        "terminal" => "terminal",
        "browser" | "websites" | "website" => "browser",
        other => return Err(format!("{name}: unsupported pane target '{other}'")),
    };
    let allowed = match target {
        "terminal" => policy.allows_terminal_pane(),
        _ => policy.allows_browser_pane(),
    };
    if !allowed {
        return Err(format!("{name}: the {target} pane is disabled for this agent"));
    }
    let sink = activity_sink
        .ok_or_else(|| format!("{name}: pane control is unavailable in this context"))?;
    let action = if name == "open_pane" { "open" } else { "close" };
    sink.emit_pane_action(action, target);
    sink.emit_status(&format!(
        "{} the {target} pane",
        if action == "open" { "Opening" } else { "Closing" }
    ));
    let result = if action == "open" {
        format!("Done: the {target} pane is now open in the FORGE UI.")
    } else {
        format!("Done: the {target} pane is now closed in the FORGE UI.")
    };
    Ok(ToolExecution {
        output: result,
        activity: None,
    })
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
        let write_tools = [
            "write_file",
            "search_replace",
            "remove_path",
            "delete_path",
            "delete_file",
            "remove_file",
            "clear_directory",
            "empty_directory",
        ];
        if !policy.allows_write() && write_tools.contains(&name) {
            return Err(format!("{name}: file write access is disabled for this agent"));
        }
        if name == "open_pane" || name == "close_pane" {
            return run_pane_tool(policy, name, &v, activity_sink);
        }
        if name.starts_with("git_") {
            return git_tool_output(policy, name, &v, activity_sink).map(|output| ToolExecution {
                output,
                activity: None,
            });
        }
        if !policy.has_file_access() {
            return Err(format!("{name}: file access is disabled for this agent"));
        }
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
            "search_replace" => {
                let path = v["path"]
                    .as_str()
                    .ok_or_else(|| "search_replace: missing path".to_string())?;
                let old_string = v["old_string"]
                    .as_str()
                    .ok_or_else(|| "search_replace: missing old_string".to_string())?;
                let new_string = v["new_string"].as_str().unwrap_or("");
                let replace_all = v["replace_all"].as_bool().unwrap_or(false);
                let result: WriteFileResult =
                    tool_search_replace(policy, path, old_string, new_string, replace_all)?;
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
        Ok(mut exec) => {
            exec.output = cap_tool_output(exec.output);
            if let Some(activity) = exec.activity.as_ref() {
                if let Some(sink) = activity_sink {
                    sink.emit(activity);
                }
            }
            exec
        }
        Err(e) => ToolExecution {
            output: cap_tool_output(format!("ERROR: {e}")),
            activity: None,
        },
    }
}

fn model_supports_tools(model_id: &str) -> bool {
    if matches!(model_id, "o1" | "o1-mini" | "o3" | "o3-mini" | "o4-mini") {
        return false;
    }
    !(model_id.starts_with("o1-") || model_id.starts_with("o3-") || model_id.starts_with("o4-"))
}

const OPENAI_MAX_OUTPUT_TOKENS: u32 = 4096;

/// Newer OpenAI chat models reject `max_tokens` and require `max_completion_tokens`.
fn openai_uses_max_completion_tokens(api_model: &str) -> bool {
    let model = api_model.trim().to_ascii_lowercase();
    model.starts_with("gpt-5")
        || model.starts_with("chatgpt-")
        || model.starts_with("o1")
        || model.starts_with("o3")
        || model.starts_with("o4")
        || model.starts_with("gpt-4.1")
        || model.starts_with("gpt-4.5")
}

fn apply_openai_output_limit(body: &mut serde_json::Value, api_model: &str) {
    let Some(obj) = body.as_object_mut() else {
        return;
    };
    obj.remove("max_tokens");
    obj.remove("max_completion_tokens");
    let key = if openai_uses_max_completion_tokens(api_model) {
        "max_completion_tokens"
    } else {
        "max_tokens"
    };
    obj.insert(key.to_string(), json!(OPENAI_MAX_OUTPUT_TOKENS));
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

    let mut body = json!({
        "model": api_model,
        "messages": api_messages,
    });
    apply_openai_output_limit(&mut body, api_model);

    let client = http_client()?;
    let res = client
        .post(&url)
        .header("Authorization", format!("Bearer {key}"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| provider_http_error(Provider::OpenAi, &url, e))?;

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
    system: Option<&str>,
    activity_sink: Option<ToolActivitySink>,
    continuation: Option<&AgentContinuationState>,
) -> Result<String, String> {
    let key = api_key(Provider::OpenAi).expect("key checked");
    let base = base_url(Provider::OpenAi, "https://api.openai.com/v1");
    validate_base_url(Provider::OpenAi, &base)?;
    let url = format!("{}/chat/completions", base.trim_end_matches('/'));
    let client = http_client()?;
    let tools = tools_schema_openai(policy);

    let mut api_messages: Vec<serde_json::Value> = if let Some(cont) =
        continuation.filter(|state| state.provider == "openai")
    {
        cont.messages.clone()
    } else {
        let mut messages: Vec<serde_json::Value> = vec![json!({
            "role": "system",
            "content": merged_workspace_system(policy, system),
        })];
        for turn in chat_messages {
            let role = if turn.role == "assistant" {
                "assistant"
            } else {
                "user"
            };
            messages.push(json!({ "role": role, "content": sanitize_chat_history_content(&turn.content) }));
        }
        messages
    };
    let from_continuation = continuation
        .map(|state| state.provider == "openai")
        .unwrap_or(false);
    let agent_loop_start = api_messages.len();
    let preserve_prefix =
        continuation_preserve_prefix(agent_loop_start, from_continuation);
    let mut activities: Vec<ToolActivity> = Vec::new();
    let mut tracker = LoopTracker::new(continuation.map(|state| state.round).unwrap_or(0));
    let mut rounds_left = MAX_TOOL_ROUNDS;

    while rounds_left > 0 {
        rounds_left -= 1;
        tracker.advance();
        emit_agent_step(activity_sink.as_ref(), tracker.round());
        compact_openai_messages(&mut api_messages, preserve_prefix);
        let mut body = json!({
            "model": api_model,
            "messages": api_messages,
            "tools": tools,
            "tool_choice": "auto",
        });
        apply_openai_output_limit(&mut body, api_model);

        let res = client
            .post(&url)
            .header("Authorization", format!("Bearer {}", key.as_str()))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| provider_http_error(Provider::OpenAi, &url, e))?;

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

                let mut signatures = Vec::new();
                for call in calls {
                    let id = call["id"].as_str().unwrap_or("");
                    let name = call["function"]["name"].as_str().unwrap_or("");
                    let args = call["function"]["arguments"].as_str().unwrap_or("{}");
                    signatures.push(tool_signature(name, args));
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
                if let Some(reason) = tracker.check_stuck(&signatures) {
                    let state = AgentContinuationState {
                        provider: provider_agent_key(Provider::OpenAi).to_string(),
                        api_model: api_model.to_string(),
                        round: tracker.round(),
                        messages: api_messages.clone(),
                    };
                    return agent_pause_message("", reason, &state, &activities);
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

    let state = AgentContinuationState {
        provider: provider_agent_key(Provider::OpenAi).to_string(),
        api_model: api_model.to_string(),
        round: tracker.round(),
        messages: api_messages,
    };
    agent_pause_message(
        "",
        &format!("reached the {MAX_TOOL_ROUNDS}-step agent limit"),
        &state,
        &activities,
    )
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
        .map_err(|e| provider_http_error(Provider::DeepSeek, &url, e))?;

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
    system: Option<&str>,
    activity_sink: Option<ToolActivitySink>,
    continuation: Option<&AgentContinuationState>,
) -> Result<String, String> {
    let key = api_key(Provider::DeepSeek).expect("key checked");
    let base = base_url(Provider::DeepSeek, "https://api.deepseek.com/v1");
    validate_base_url(Provider::DeepSeek, &base)?;
    let url = format!("{}/chat/completions", base.trim_end_matches('/'));
    let client = http_client()?;
    let tools = tools_schema_openai(policy);

    let mut api_messages: Vec<serde_json::Value> = if let Some(cont) =
        continuation.filter(|state| state.provider == "deepseek")
    {
        cont.messages.clone()
    } else {
        let mut messages: Vec<serde_json::Value> = vec![json!({
            "role": "system",
            "content": merged_workspace_system(policy, system),
        })];
        for turn in chat_messages {
            let role = if turn.role == "assistant" {
                "assistant"
            } else {
                "user"
            };
            messages.push(json!({ "role": role, "content": sanitize_chat_history_content(&turn.content) }));
        }
        messages
    };
    let from_continuation = continuation
        .map(|state| state.provider == "deepseek")
        .unwrap_or(false);
    let agent_loop_start = api_messages.len();
    let preserve_prefix =
        continuation_preserve_prefix(agent_loop_start, from_continuation);
    let mut activities: Vec<ToolActivity> = Vec::new();
    let mut tracker = LoopTracker::new(continuation.map(|state| state.round).unwrap_or(0));
    let mut rounds_left = MAX_TOOL_ROUNDS;

    while rounds_left > 0 {
        rounds_left -= 1;
        tracker.advance();
        emit_agent_step(activity_sink.as_ref(), tracker.round());
        compact_openai_messages(&mut api_messages, preserve_prefix);
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
            .map_err(|e| provider_http_error(Provider::DeepSeek, &url, e))?;

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

                let mut signatures = Vec::new();
                for call in calls {
                    let id = call["id"].as_str().unwrap_or("");
                    let name = call["function"]["name"].as_str().unwrap_or("");
                    let args = call["function"]["arguments"].as_str().unwrap_or("{}");
                    signatures.push(tool_signature(name, args));
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
                if let Some(reason) = tracker.check_stuck(&signatures) {
                    let state = AgentContinuationState {
                        provider: provider_agent_key(Provider::DeepSeek).to_string(),
                        api_model: api_model.to_string(),
                        round: tracker.round(),
                        messages: api_messages.clone(),
                    };
                    return agent_pause_message("", reason, &state, &activities);
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

    let state = AgentContinuationState {
        provider: provider_agent_key(Provider::DeepSeek).to_string(),
        api_model: api_model.to_string(),
        round: tracker.round(),
        messages: api_messages,
    };
    agent_pause_message(
        "",
        &format!("reached the {MAX_TOOL_ROUNDS}-step agent limit"),
        &state,
        &activities,
    )
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
        .map_err(|e| provider_http_error(Provider::Xai, &url, e))?;

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
    system: Option<&str>,
    activity_sink: Option<ToolActivitySink>,
    continuation: Option<&AgentContinuationState>,
) -> Result<String, String> {
    let key = api_key(Provider::Xai).expect("key checked");
    let base = base_url(Provider::Xai, "https://api.x.ai/v1");
    validate_base_url(Provider::Xai, &base)?;
    let url = format!("{}/chat/completions", base.trim_end_matches('/'));
    let client = http_client()?;
    let tools = tools_schema_openai(policy);

    let mut api_messages: Vec<serde_json::Value> = if let Some(cont) =
        continuation.filter(|state| state.provider == "xai")
    {
        cont.messages.clone()
    } else {
        let mut messages: Vec<serde_json::Value> = vec![json!({
            "role": "system",
            "content": merged_workspace_system(policy, system),
        })];
        for turn in chat_messages {
            let role = if turn.role == "assistant" {
                "assistant"
            } else {
                "user"
            };
            messages.push(json!({ "role": role, "content": sanitize_chat_history_content(&turn.content) }));
        }
        messages
    };
    let from_continuation = continuation
        .map(|state| state.provider == "xai")
        .unwrap_or(false);
    let agent_loop_start = api_messages.len();
    let preserve_prefix =
        continuation_preserve_prefix(agent_loop_start, from_continuation);
    let mut activities: Vec<ToolActivity> = Vec::new();
    let mut tracker = LoopTracker::new(continuation.map(|state| state.round).unwrap_or(0));
    let mut rounds_left = MAX_TOOL_ROUNDS;

    while rounds_left > 0 {
        rounds_left -= 1;
        tracker.advance();
        emit_agent_step(activity_sink.as_ref(), tracker.round());
        compact_openai_messages(&mut api_messages, preserve_prefix);
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
            .map_err(|e| provider_http_error(Provider::Xai, &url, e))?;

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

                let mut signatures = Vec::new();
                for call in calls {
                    let id = call["id"].as_str().unwrap_or("");
                    let name = call["function"]["name"].as_str().unwrap_or("");
                    let args = call["function"]["arguments"].as_str().unwrap_or("{}");
                    signatures.push(tool_signature(name, args));
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
                if let Some(reason) = tracker.check_stuck(&signatures) {
                    let state = AgentContinuationState {
                        provider: provider_agent_key(Provider::Xai).to_string(),
                        api_model: api_model.to_string(),
                        round: tracker.round(),
                        messages: api_messages.clone(),
                    };
                    return agent_pause_message("", reason, &state, &activities);
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

    let state = AgentContinuationState {
        provider: provider_agent_key(Provider::Xai).to_string(),
        api_model: api_model.to_string(),
        round: tracker.round(),
        messages: api_messages,
    };
    agent_pause_message(
        "",
        &format!("reached the {MAX_TOOL_ROUNDS}-step agent limit"),
        &state,
        &activities,
    )
}

async fn xai_agent_loop(
    api_model: &str,
    chat_messages: &[ChatTurn],
    policy: &WorkspacePolicy,
    system: Option<&str>,
    activity_sink: Option<ToolActivitySink>,
    continuation: Option<&AgentContinuationState>,
) -> Result<String, String> {
    let api_model = resolve_runtime_model(api_model).await;
    match xai_agent_loop_once(
        &api_model,
        chat_messages,
        policy,
        system,
        activity_sink.clone(),
        continuation,
    )
    .await
    {
        Ok(content) => Ok(content),
        Err(err) if is_model_not_found_error(&err) => {
            invalidate_cache();
            let fallback = default_account_chat_model().await;
            if fallback == api_model {
                return Err(err);
            }
            xai_agent_loop_once(
                &fallback,
                chat_messages,
                policy,
                system,
                activity_sink,
                continuation,
            )
            .await
        }
        Err(err) => Err(err),
    }
}

fn append_file_tools_anthropic(tools: &mut Vec<serde_json::Value>, policy: &WorkspacePolicy) {
    if !policy.has_file_access() {
        return;
    }
    tools.extend([
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
    ]);
    if policy.allows_write() {
        tools.extend([
            json!({
                "name": "write_file",
                "description": "Create or overwrite a UTF-8 text file under AI-enabled paths. Requires the full file body. For large existing files, prefer search_replace—truncated write_file payloads are rejected.",
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
                "name": "search_replace",
                "description": "Replace one exact substring in an existing UTF-8 text file. Prefer for partial edits to large files. old_string must match exactly. When replace_all is false, old_string must appear exactly once.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" },
                        "old_string": { "type": "string" },
                        "new_string": { "type": "string" },
                        "replace_all": { "type": "boolean" }
                    },
                    "required": ["path", "old_string", "new_string"]
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
        ]);
    }
}

fn append_git_tools_anthropic(tools: &mut Vec<serde_json::Value>) {
    tools.extend([
        json!({
            "name": "git_status",
            "description": "Show git status for the active repository.",
            "input_schema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "git_pull",
            "description": "Pull latest changes from the remote.",
            "input_schema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "git_push",
            "description": "Push local commits to the remote.",
            "input_schema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "git_fetch",
            "description": "Fetch from the remote without merging.",
            "input_schema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "git_init",
            "description": "Initialize a new git repository.",
            "input_schema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "git_commit",
            "description": "Create a git commit.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "message": { "type": "string" },
                    "stageAll": { "type": "boolean" }
                },
                "required": ["message"]
            }
        }),
        json!({
            "name": "git_clone",
            "description": "Clone a remote repository.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "url": { "type": "string" },
                    "parentPath": { "type": "string" }
                },
                "required": ["url"]
            }
        }),
        json!({
            "name": "git_restore_paths",
            "description": "Discard changes to tracked files and remove untracked paths.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "paths": { "type": "array", "items": { "type": "string" } }
                },
                "required": ["paths"]
            }
        }),
    ]);
}

fn append_pane_tools_anthropic(tools: &mut Vec<serde_json::Value>, policy: &WorkspacePolicy) {
    let targets = pane_tool_targets(policy);
    if targets.is_empty() {
        return;
    }
    let input_schema = json!({
        "type": "object",
        "properties": {
            "target": { "type": "string", "enum": targets, "description": "Pane to act on" }
        },
        "required": ["target"]
    });
    tools.extend([
        json!({
            "name": "open_pane",
            "description": OPEN_PANE_DESCRIPTION,
            "input_schema": input_schema.clone()
        }),
        json!({
            "name": "close_pane",
            "description": CLOSE_PANE_DESCRIPTION,
            "input_schema": input_schema
        }),
    ]);
}

fn anthropic_tools(policy: &WorkspacePolicy) -> Vec<serde_json::Value> {
    let mut tools = Vec::new();
    append_file_tools_anthropic(&mut tools, policy);
    if policy.allows_git() {
        append_git_tools_anthropic(&mut tools);
    }
    append_pane_tools_anthropic(&mut tools, policy);
    tools
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
    let res = anthropic_post(&client, &url, key.as_str())
        .json(&body)
        .send()
        .await
        .map_err(|e| provider_http_error(Provider::Anthropic, &url, e))?;

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
    system: Option<&str>,
    activity_sink: Option<ToolActivitySink>,
    continuation: Option<&AgentContinuationState>,
) -> Result<String, String> {
    let key = api_key(Provider::Anthropic).expect("key checked");
    let base = base_url(Provider::Anthropic, "https://api.anthropic.com");
    validate_base_url(Provider::Anthropic, &base)?;
    let url = format!("{}/v1/messages", base.trim_end_matches('/'));
    let client = http_client()?;
    let tools = anthropic_tools(policy);

    let mut api_messages: Vec<serde_json::Value> = if let Some(cont) =
        continuation.filter(|state| state.provider == "anthropic")
    {
        cont.messages.clone()
    } else {
        let mut messages: Vec<serde_json::Value> = Vec::new();
        for turn in chat_messages {
            let role = if turn.role == "assistant" {
                "assistant"
            } else {
                "user"
            };
            messages.push(json!({
                "role": role,
                "content": [{ "type": "text", "text": sanitize_chat_history_content(&turn.content) }],
            }));
        }
        messages
    };
    let from_continuation = continuation
        .map(|state| state.provider == "anthropic")
        .unwrap_or(false);
    let agent_loop_start = api_messages.len();
    let preserve_prefix =
        continuation_preserve_prefix(agent_loop_start, from_continuation);
    let system_prompt = merged_workspace_system(policy, system);
    let cached_tools = anthropic_cached_tools(&tools);
    let mut activities: Vec<ToolActivity> = Vec::new();
    let mut tracker = LoopTracker::new(continuation.map(|state| state.round).unwrap_or(0));
    let mut rounds_left = MAX_TOOL_ROUNDS;

    while rounds_left > 0 {
        rounds_left -= 1;
        tracker.advance();
        emit_agent_step(activity_sink.as_ref(), tracker.round());
        compact_anthropic_messages(&mut api_messages, preserve_prefix);
        let body = json!({
            "model": api_model,
            "max_tokens": 4096,
            "system": anthropic_cached_system(&system_prompt),
            "tools": cached_tools,
            "messages": api_messages,
        });

        let res = anthropic_post_with_cache(&client, &url, key.as_str(), true)
            .json(&body)
            .send()
            .await
            .map_err(|e| provider_http_error(Provider::Anthropic, &url, e))?;

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
            let sig_calls: Vec<(String, String)> = tool_uses
                .iter()
                .map(|(_, name, args)| (name.clone(), args.clone()))
                .collect();
            let signatures = tool_signatures_from_json_args(&sig_calls);
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
            if let Some(reason) = tracker.check_stuck(&signatures) {
                let state = AgentContinuationState {
                    provider: provider_agent_key(Provider::Anthropic).to_string(),
                    api_model: api_model.to_string(),
                    round: tracker.round(),
                    messages: api_messages.clone(),
                };
                return agent_pause_message("", reason, &state, &activities);
            }
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

    let state = AgentContinuationState {
        provider: provider_agent_key(Provider::Anthropic).to_string(),
        api_model: api_model.to_string(),
        round: tracker.round(),
        messages: api_messages,
    };
    agent_pause_message(
        "",
        &format!("reached the {MAX_TOOL_ROUNDS}-step agent limit"),
        &state,
        &activities,
    )
}

fn append_file_tools_gemini(declarations: &mut Vec<serde_json::Value>, policy: &WorkspacePolicy) {
    if !policy.has_file_access() {
        return;
    }
    declarations.extend([
        json!({
            "name": "read_file",
            "description": "Read a UTF-8 text file under AI-enabled paths. Prefer over guessing when the task depends on real project contents.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": { "type": "string" }
                },
                "required": ["path"]
            }
        }),
        json!({
            "name": "list_directory",
            "description": "List files and subfolders under an AI-enabled directory. Use to discover which files to read.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": { "type": "string" }
                },
                "required": ["path"]
            }
        }),
    ]);
    if policy.allows_write() {
        declarations.extend([
            json!({
                "name": "write_file",
                "description": "Create or overwrite a UTF-8 text file under AI-enabled paths. Requires the full file body. For large existing files, prefer search_replace—truncated write_file payloads are rejected.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" },
                        "content": { "type": "string" }
                    },
                    "required": ["path", "content"]
                }
            }),
            json!({
                "name": "search_replace",
                "description": "Replace one exact substring in an existing UTF-8 text file. Prefer for partial edits to large files. old_string must match exactly. When replace_all is false, old_string must appear exactly once.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" },
                        "old_string": { "type": "string" },
                        "new_string": { "type": "string" },
                        "replace_all": { "type": "boolean" }
                    },
                    "required": ["path", "old_string", "new_string"]
                }
            }),
            json!({
                "name": "remove_path",
                "description": "Permanently delete a file or folder (recursive). Use when the user asks to delete files or folders.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" }
                    },
                    "required": ["path"]
                }
            }),
            json!({
                "name": "clear_directory",
                "description": "Delete all contents inside a directory but keep the directory. Use to empty or clear a folder.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" }
                    },
                    "required": ["path"]
                }
            }),
        ]);
    }
}

fn append_git_tools_gemini(declarations: &mut Vec<serde_json::Value>) {
    declarations.extend([
        json!({
            "name": "git_status",
            "description": "Show git status for the active repository.",
            "parameters": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "git_pull",
            "description": "Pull latest changes from the remote.",
            "parameters": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "git_push",
            "description": "Push local commits to the remote.",
            "parameters": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "git_fetch",
            "description": "Fetch from the remote without merging.",
            "parameters": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "git_init",
            "description": "Initialize a new git repository.",
            "parameters": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "git_commit",
            "description": "Create a git commit.",
            "parameters": {
                "type": "object",
                "properties": {
                    "message": { "type": "string" },
                    "stageAll": { "type": "boolean" }
                },
                "required": ["message"]
            }
        }),
        json!({
            "name": "git_clone",
            "description": "Clone a remote repository.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": { "type": "string" },
                    "parentPath": { "type": "string" }
                },
                "required": ["url"]
            }
        }),
        json!({
            "name": "git_restore_paths",
            "description": "Discard changes to tracked files and remove untracked paths.",
            "parameters": {
                "type": "object",
                "properties": {
                    "paths": { "type": "array", "items": { "type": "string" } }
                },
                "required": ["paths"]
            }
        }),
    ]);
}

fn append_pane_tools_gemini(declarations: &mut Vec<serde_json::Value>, policy: &WorkspacePolicy) {
    let targets = pane_tool_targets(policy);
    if targets.is_empty() {
        return;
    }
    let parameters = json!({
        "type": "object",
        "properties": {
            "target": { "type": "string", "enum": targets }
        },
        "required": ["target"]
    });
    declarations.extend([
        json!({
            "name": "open_pane",
            "description": OPEN_PANE_DESCRIPTION,
            "parameters": parameters.clone()
        }),
        json!({
            "name": "close_pane",
            "description": CLOSE_PANE_DESCRIPTION,
            "parameters": parameters
        }),
    ]);
}

fn gemini_tool_declarations(policy: &WorkspacePolicy) -> serde_json::Value {
    let mut declarations = Vec::new();
    append_file_tools_gemini(&mut declarations, policy);
    if policy.allows_git() {
        append_git_tools_gemini(&mut declarations);
    }
    append_pane_tools_gemini(&mut declarations, policy);
    json!([{ "function_declarations": declarations }])
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
    let url = gemini_generate_url(&base, api_model, key.as_str());

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
    let res = gemini_post(&client, &url, key.as_str())
        .json(&body)
        .send()
        .await
        .map_err(|e| provider_http_error(Provider::Google, &url, e))?;

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
    system: Option<&str>,
    activity_sink: Option<ToolActivitySink>,
    continuation: Option<&AgentContinuationState>,
) -> Result<String, String> {
    let key = api_key(Provider::Google).expect("key checked");
    let base = base_url(
        Provider::Google,
        "https://generativelanguage.googleapis.com/v1beta",
    );
    validate_base_url(Provider::Google, &base)?;
    let url = gemini_generate_url(&base, api_model, key.as_str());
    let client = http_client()?;
    let mut activities: Vec<ToolActivity> = Vec::new();

    let mut contents: Vec<serde_json::Value> = if let Some(cont) =
        continuation.filter(|state| state.provider == "google")
    {
        cont.messages.clone()
    } else {
        let mut history: Vec<serde_json::Value> = Vec::new();
        for turn in chat_messages {
            let role = if turn.role == "assistant" {
                "model"
            } else {
                "user"
            };
            history.push(json!({
                "role": role,
                "parts": [{ "text": sanitize_chat_history_content(&turn.content) }],
            }));
        }
        history
    };

    let from_continuation = continuation
        .map(|state| state.provider == "google")
        .unwrap_or(false);
    let agent_loop_start = contents.len();
    let preserve_prefix =
        continuation_preserve_prefix(agent_loop_start, from_continuation);
    let mut tracker = LoopTracker::new(continuation.map(|state| state.round).unwrap_or(0));
    let mut rounds_left = MAX_TOOL_ROUNDS;

    while rounds_left > 0 {
        rounds_left -= 1;
        tracker.advance();
        emit_agent_step(activity_sink.as_ref(), tracker.round());
        compact_gemini_contents(&mut contents, preserve_prefix);
        let body = json!({
            "contents": contents,
            "systemInstruction": {
                "parts": [{ "text": merged_workspace_system(policy, system) }],
            },
            "tools": gemini_tool_declarations(policy),
        });

        let res = gemini_post(&client, &url, key.as_str())
            .json(&body)
            .send()
            .await
            .map_err(|e| provider_http_error(Provider::Google, &url, e))?;

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
            let sig_calls: Vec<(String, String)> = function_calls
                .iter()
                .map(|(name, args_val)| {
                    (
                        name.clone(),
                        serde_json::to_string(args_val).unwrap_or_else(|_| "{}".to_string()),
                    )
                })
                .collect();
            let signatures = tool_signatures_from_json_args(&sig_calls);
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
            if let Some(reason) = tracker.check_stuck(&signatures) {
                let state = AgentContinuationState {
                    provider: provider_agent_key(Provider::Google).to_string(),
                    api_model: api_model.to_string(),
                    round: tracker.round(),
                    messages: contents.clone(),
                };
                return agent_pause_message("", reason, &state, &activities);
            }
            continue;
        }

        return text_out
            .map(|s| with_tool_activity(s, &activities))
            .filter(|s| !s.trim().is_empty())
            .ok_or_else(|| provider_error(Provider::Google, "response", "empty assistant message"));
    }

    let state = AgentContinuationState {
        provider: provider_agent_key(Provider::Google).to_string(),
        api_model: api_model.to_string(),
        round: tracker.round(),
        messages: contents,
    };
    agent_pause_message(
        "",
        &format!("reached the {MAX_TOOL_ROUNDS}-step agent limit"),
        &state,
        &activities,
    )
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
    system: Option<&str>,
    activity_sink: Option<ToolActivitySink>,
    continuation: Option<&AgentContinuationState>,
) -> Result<String, String> {
    let (provider, api_model) = resolve_api_model(model_id)?;
    if !model_supports_tools(model_id) {
        let sys = merged_workspace_system(policy, system);
        return complete_for_model(model_id, messages, Some(sys.as_str())).await;
    }
    match provider {
        Provider::OpenAi => {
            openai_agent_loop(
                &api_model,
                messages,
                policy,
                system,
                activity_sink,
                continuation,
            )
            .await
        }
        Provider::Anthropic => {
            anthropic_agent_loop(
                &api_model,
                messages,
                policy,
                system,
                activity_sink,
                continuation,
            )
            .await
        }
        Provider::Google => {
            gemini_agent_loop(
                &api_model,
                messages,
                policy,
                system,
                activity_sink,
                continuation,
            )
            .await
        }
        Provider::DeepSeek => {
            deepseek_agent_loop(
                &api_model,
                messages,
                policy,
                system,
                activity_sink,
                continuation,
            )
            .await
        }
        Provider::Xai => {
            xai_agent_loop(
                &api_model,
                messages,
                policy,
                system,
                activity_sink,
                continuation,
            )
            .await
        }
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
    agent_continuation: Option<String>,
) -> Result<String, String> {
    let continuation = parse_agent_continuation(agent_continuation)?;
    if messages.is_empty() && continuation.is_none() {
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
                system.as_deref(),
                activity_sink,
                continuation.as_ref(),
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
        "No AI provider credentials are configured. Set FORGE_BACKEND_URL and FORGE_BACKEND_TOKEN for managed mode (Render), or configure provider API keys for local mode.".to_string()
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
