use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::mpsc;
use tokio::sync::oneshot;

pub struct McpClient {
    request_tx: mpsc::Sender<(Value, oneshot::Sender<Result<Value, String>>)>,
    next_id: AtomicU64,
}

pub static MCP_CLIENT: std::sync::LazyLock<tokio::sync::Mutex<Option<std::sync::Arc<McpClient>>>> = std::sync::LazyLock::new(|| tokio::sync::Mutex::new(None));

impl McpClient {
    pub async fn new(env_vars: HashMap<String, String>) -> Result<Self, String> {
        let mut child = Command::new(if cfg!(target_os = "windows") { "npx.cmd" } else { "npx" })
            .arg("-y")
            .arg("@supabase/mcp-server-supabase")
            .envs(&env_vars)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn MCP server: {}", e))?;

        let stdin = child.stdin.take().ok_or("Failed to open stdin")?;
        let stdout = child.stdout.take().ok_or("Failed to open stdout")?;

        let (request_tx, mut request_rx) = mpsc::channel::<(Value, oneshot::Sender<Result<Value, String>>)>(32);
        let pending_requests = std::sync::Arc::new(tokio::sync::Mutex::new(HashMap::<u64, oneshot::Sender<Result<Value, String>>>::new()));
        let pending_requests_clone = pending_requests.clone();

        // Stdin writer task
        let mut stdin_writer = tokio::io::BufWriter::new(stdin);
        let (stdin_tx, mut stdin_rx) = mpsc::channel::<String>(32);

        tokio::spawn(async move {
            while let Some(msg) = stdin_rx.recv().await {
                if stdin_writer.write_all(msg.as_bytes()).await.is_err() {
                    break;
                }
                if stdin_writer.flush().await.is_err() {
                    break;
                }
            }
        });

        // Request handling task
        tokio::spawn(async move {
            while let Some((mut req, reply_tx)) = request_rx.recv().await {
                let id = req["id"].as_u64().unwrap_or(0);
                pending_requests.lock().await.insert(id, reply_tx);
                let mut msg = serde_json::to_string(&req).unwrap_or_default();
                msg.push('\n');
                let _ = stdin_tx.send(msg).await;
            }
        });

        // Stdout reader task
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                if let Ok(val) = serde_json::from_str::<Value>(&line) {
                    if let Some(id) = val.get("id").and_then(|i| i.as_u64()) {
                        if let Some(reply_tx) = pending_requests_clone.lock().await.remove(&id) {
                            if let Some(err) = val.get("error") {
                                let _ = reply_tx.send(Err(err.to_string()));
                            } else {
                                let _ = reply_tx.send(Ok(val["result"].clone()));
                            }
                        }
                    }
                }
            }
        });

        let client = Self {
            request_tx,
            next_id: AtomicU64::new(1),
        };

        // Initialize MCP
        let init_params = json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "ForgeIDE",
                "version": "1.0.0"
            }
        });
        
        client.send_request("initialize", init_params).await?;

        // Send notifications
        let _ = client.send_notification("notifications/initialized", json!({})).await;

        Ok(client)
    }

    async fn send_request(&self, method: &str, params: Value) -> Result<Value, String> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let req = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params
        });

        let (tx, rx) = oneshot::channel();
        self.request_tx.send((req, tx)).await.map_err(|_| "Client stopped")?;
        
        tokio::time::timeout(std::time::Duration::from_secs(10), rx)
            .await
            .map_err(|_| "Request timed out")?
            .map_err(|_| "Request cancelled")?
    }

    async fn send_notification(&self, method: &str, params: Value) -> Result<(), String> {
        let req = json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params
        });
        let (tx, _) = oneshot::channel(); // Notifications don't need a response, but we reuse the channel shape
        let mut msg = serde_json::to_string(&req).unwrap_or_default();
        msg.push('\n');
        // We'll just fire and forget by bypassing the ID tracking
        // For simplicity, we just send it as a request with no ID, which the event loop ignores response-wise.
        let req_with_no_id = json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params
        });
        let _ = self.request_tx.send((req_with_no_id, tx)).await;
        Ok(())
    }

    pub async fn list_tools(&self) -> Result<Vec<Value>, String> {
        let res = self.send_request("tools/list", json!({})).await?;
        let tools = res.get("tools")
            .and_then(|t| t.as_array())
            .cloned()
            .unwrap_or_default();
        
        let mut openai_tools = Vec::new();
        for t in tools {
            if let (Some(name), Some(desc), Some(schema)) = (
                t.get("name").and_then(|n| n.as_str()),
                t.get("description").and_then(|d| d.as_str()),
                t.get("inputSchema")
            ) {
                openai_tools.push(json!({
                    "type": "function",
                    "function": {
                        "name": format!("mcp_supabase_{}", name),
                        "description": format!("(Supabase MCP) {}", desc),
                        "parameters": schema
                    }
                }));
            }
        }
        Ok(openai_tools)
    }

    pub async fn call_tool(&self, name: &str, arguments: Value) -> Result<String, String> {
        let actual_name = name.strip_prefix("mcp_supabase_").unwrap_or(name);
        let res = self.send_request("tools/call", json!({
            "name": actual_name,
            "arguments": arguments
        })).await?;

        if let Some(content) = res.get("content").and_then(|c| c.as_array()) {
            let mut output = String::new();
            for item in content {
                if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                    output.push_str(text);
                    output.push('\n');
                }
            }
            Ok(output.trim().to_string())
        } else {
            Ok(res.to_string())
        }
    }
}

pub async fn get_mcp_tools() -> Result<Vec<Value>, String> {
    let mut lock = MCP_CLIENT.lock().await;
    if lock.is_none() {
        let app_data = std::env::var("APPDATA").unwrap_or_default();
        if !app_data.is_empty() {
            let path = std::path::Path::new(&app_data).join("com.forge.desktop").join("supabase.v1.json");
            if let Ok(content) = std::fs::read_to_string(&path) {
                if let Ok(json) = serde_json::from_str::<Value>(&content) {
                    if let Some(config) = json.get("config") {
                        let anon_key = config.get("anonKey").and_then(|v| v.as_str()).unwrap_or("");
                        let project_ref = config.get("projectRef").and_then(|v| v.as_str()).unwrap_or("");
                        let project_url = config.get("projectUrl").and_then(|v| v.as_str()).unwrap_or("").trim();
                        let pat = config.get("personalAccessToken").and_then(|v| v.as_str()).unwrap_or("");
                        
                        if !anon_key.is_empty() && !project_ref.is_empty() {
                            let mut envs = HashMap::new();
                            envs.insert("SUPABASE_ANON_KEY".to_string(), anon_key.to_string());
                            envs.insert("SUPABASE_PROJECT_REF".to_string(), project_ref.to_string());
                            envs.insert("SUPABASE_PROJECT_URL".to_string(), project_url.to_string());
                            envs.insert("SUPABASE_ACCESS_TOKEN".to_string(), pat.to_string());
                            // Need to disable prompt/interactive commands in npx
                            envs.insert("npm_config_yes".to_string(), "true".to_string());
                            
                            if let Ok(client) = McpClient::new(envs).await {
                                *lock = Some(std::sync::Arc::new(client));
                            }
                        }
                    }
                }
            }
        }
    }
    
    if let Some(client) = lock.as_ref() {
        client.list_tools().await
    } else {
        Ok(vec![])
    }
}

pub async fn execute_mcp_tool(name: &str, args: &str) -> Result<String, String> {
    let client_opt = {
        let lock = MCP_CLIENT.lock().await;
        lock.clone()
    };
    if let Some(client) = client_opt {
        let args_val: Value = serde_json::from_str(args).map_err(|e| e.to_string())?;
        client.call_tool(name, args_val).await
    } else {
        Err("MCP client not initialized".to_string())
    }
}

pub fn to_anthropic_tools(openai_tools: &[Value]) -> Vec<Value> {
    openai_tools.iter().map(|tool| {
        let f = &tool["function"];
        json!({
            "name": f["name"],
            "description": f["description"],
            "input_schema": f["parameters"]
        })
    }).collect()
}

pub fn to_gemini_tools(openai_tools: &[Value]) -> Vec<Value> {
    openai_tools.iter().map(|tool| {
        tool["function"].clone()
    }).collect()
}

#[tauri::command]
pub async fn verify_supabase_mcp_config(
    project_url: String,
    anon_key: String,
    project_ref: String,
    pat: String,
) -> Result<String, String> {
    let mut envs = HashMap::new();
    envs.insert("SUPABASE_ANON_KEY".to_string(), anon_key);
    envs.insert("SUPABASE_PROJECT_REF".to_string(), project_ref);
    envs.insert("SUPABASE_PROJECT_URL".to_string(), project_url);
    envs.insert("SUPABASE_ACCESS_TOKEN".to_string(), pat);
    envs.insert("npm_config_yes".to_string(), "true".to_string());
    
    match McpClient::new(envs).await {
        Ok(client) => {
            match client.list_tools().await {
                Ok(tools) => {
                    Ok(format!("MCP Server started successfully with {} tools", tools.len()))
                },
                Err(e) => Err(format!("MCP Server started but failed to list tools: {}", e))
            }
        },
        Err(e) => Err(format!("Failed to start MCP server: {}. Please ensure Node.js and npx are installed.", e))
    }
}
