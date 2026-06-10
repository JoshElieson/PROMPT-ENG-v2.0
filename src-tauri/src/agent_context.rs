//! Agent context budgeting (Cursor-style): cap tool output, compact stale tool
//! turns, and strip large payloads from history so input tokens do not compound
//! across dozens of agent steps.

use serde_json::{json, Value};

/// Max characters returned from any single tool call to the model (~6K tokens).
pub const MAX_TOOL_RESULT_CHARS: usize = 24_000;
/// Keep this many recent agent turns (assistant + tool result pairs).
pub const KEEP_RECENT_AGENT_TURNS: usize = 8;

const TRUNCATED_TOOL_NOTE: &str = "\n\n[Output truncated for context budget. Re-read the file or narrow the query if you need more.]";
const COMPACTED_TOOL_NOTE: &str =
    "[Earlier tool output removed from context to control token usage. Use read_file again if needed.]";
const COMPACTED_WRITE_NOTE: &str = "[file content omitted from context]";

pub fn cap_tool_output(output: String) -> String {
    if output.chars().count() <= MAX_TOOL_RESULT_CHARS {
        return output;
    }
    let truncated: String = output.chars().take(MAX_TOOL_RESULT_CHARS).collect();
    format!("{truncated}{TRUNCATED_TOOL_NOTE}")
}

fn should_compact(messages: &[Value], preserve_prefix: usize) -> bool {
    messages.len() > preserve_prefix + KEEP_RECENT_AGENT_TURNS * 2
}

fn compact_start_index(messages_len: usize, preserve_prefix: usize) -> Option<usize> {
    let keep_from = messages_len.saturating_sub(KEEP_RECENT_AGENT_TURNS * 2);
    if keep_from <= preserve_prefix {
        return None;
    }
    Some(preserve_prefix)
}

fn truncate_text_value(text: &str, replacement: &str) -> String {
    if text.chars().count() <= MAX_TOOL_RESULT_CHARS {
        return text.to_string();
    }
    replacement.to_string()
}

fn strip_write_payload(value: &mut Value) {
    if let Some(name) = value.get("name").and_then(|v| v.as_str()) {
        if name == "write_file" {
            if let Some(input) = value.get_mut("input").and_then(|v| v.as_object_mut()) {
                if input.contains_key("content") {
                    input.insert("content".to_string(), json!(COMPACTED_WRITE_NOTE));
                }
            }
        }
    }
    if let Some(function) = value.get_mut("function").and_then(|v| v.as_object_mut()) {
        if function.get("name").and_then(|v| v.as_str()) == Some("write_file") {
            if let Some(args) = function.get_mut("arguments").and_then(|v| v.as_str()) {
                if let Ok(mut parsed) = serde_json::from_str::<Value>(args) {
                    if let Some(obj) = parsed.as_object_mut() {
                        if obj.contains_key("content") {
                            obj.insert("content".to_string(), json!(COMPACTED_WRITE_NOTE));
                            if let Ok(next) = serde_json::to_string(obj) {
                                function.insert("arguments".to_string(), json!(next));
                            }
                        }
                    }
                }
            }
        }
    }
}

fn compact_openai_message(message: &mut Value, compacted: bool) {
    let role = message.get("role").and_then(|v| v.as_str()).unwrap_or("");
    if role == "tool" {
        if let Some(content) = message.get_mut("content") {
            if compacted {
                *content = json!(COMPACTED_TOOL_NOTE);
            } else if let Some(text) = content.as_str() {
                *content = json!(truncate_text_value(text, COMPACTED_TOOL_NOTE));
            }
        }
        return;
    }
    if role == "assistant" {
        if let Some(tool_calls) = message.get_mut("tool_calls").and_then(|v| v.as_array_mut()) {
            for call in tool_calls {
                strip_write_payload(call);
                if compacted {
                    if let Some(function) = call.get_mut("function").and_then(|v| v.as_object_mut())
                    {
                        if let Some(args) = function.get("arguments").and_then(|v| v.as_str()) {
                            if args.len() > 512 {
                                function.insert(
                                    "arguments".to_string(),
                                    json!("{\"note\":\"[tool arguments omitted from context]\"}"),
                                );
                            }
                        }
                    }
                }
            }
        }
    }
}

fn compact_anthropic_message(message: &mut Value, compacted: bool) {
    let Some(content) = message.get_mut("content").and_then(|v| v.as_array_mut()) else {
        return;
    };
    for block in content.iter_mut() {
        match block.get("type").and_then(|v| v.as_str()) {
            Some("tool_result") => {
                if compacted {
                    block["content"] = json!(COMPACTED_TOOL_NOTE);
                } else if let Some(text) = block["content"].as_str() {
                    block["content"] = json!(truncate_text_value(text, COMPACTED_TOOL_NOTE));
                }
            }
            Some("tool_use") => {
                strip_write_payload(block);
            }
            Some("text") if compacted => {
                if let Some(text) = block.get("text").and_then(|v| v.as_str()) {
                    if text.len() > 4_000 {
                        block["text"] = json!("[Earlier assistant text omitted from context]");
                    }
                }
            }
            _ => {}
        }
    }
}

fn compact_gemini_content(content: &mut Value, compacted: bool) {
    let Some(parts) = content.get_mut("parts").and_then(|v| v.as_array_mut()) else {
        return;
    };
    for part in parts.iter_mut() {
        if let Some(text) = part.get_mut("text") {
            if compacted {
                *text = json!(COMPACTED_TOOL_NOTE);
            } else if let Some(raw) = text.as_str() {
                *text = json!(truncate_text_value(raw, COMPACTED_TOOL_NOTE));
            }
        }
        if let Some(function_response) =
            part.get_mut("functionResponse").and_then(|v| v.as_object_mut())
        {
            if compacted {
                function_response.insert(
                    "response".to_string(),
                    json!({ "result": COMPACTED_TOOL_NOTE }),
                );
            } else if let Some(response) = function_response.get_mut("response") {
                if let Some(result) = response.get("result").and_then(|v| v.as_str()) {
                    response["result"] = json!(truncate_text_value(result, COMPACTED_TOOL_NOTE));
                }
            }
        }
        if let Some(function_call) = part.get_mut("functionCall").and_then(|v| v.as_object_mut()) {
            if function_call.get("name").and_then(|v| v.as_str()) == Some("write_file") {
                if let Some(args) = function_call.get_mut("args").and_then(|v| v.as_object_mut()) {
                    if args.contains_key("content") {
                        args.insert("content".to_string(), json!(COMPACTED_WRITE_NOTE));
                    }
                }
            }
        }
    }
}

fn compact_range(messages: &mut [Value], preserve_prefix: usize, compact_fn: fn(&mut Value, bool)) {
    let Some(start) = compact_start_index(messages.len(), preserve_prefix) else {
        return;
    };
    let keep_from = messages.len().saturating_sub(KEEP_RECENT_AGENT_TURNS * 2);
    for message in messages.iter_mut().take(keep_from).skip(start) {
        compact_fn(message, true);
    }
}

pub fn compact_openai_messages(messages: &mut Vec<Value>, preserve_prefix: usize) {
    if !should_compact(messages, preserve_prefix) {
        return;
    }
    compact_range(messages, preserve_prefix, compact_openai_message);
}

pub fn compact_anthropic_messages(messages: &mut Vec<Value>, preserve_prefix: usize) {
    if !should_compact(messages, preserve_prefix) {
        return;
    }
    compact_range(messages, preserve_prefix, compact_anthropic_message);
}

pub fn compact_gemini_contents(contents: &mut Vec<Value>, preserve_prefix: usize) {
    if !should_compact(contents, preserve_prefix) {
        return;
    }
    compact_range(contents, preserve_prefix, compact_gemini_content);
}

pub fn continuation_preserve_prefix(message_count: usize, from_continuation: bool) -> usize {
    if from_continuation {
        4.min(message_count)
    } else {
        message_count
    }
}

pub fn anthropic_cached_system(system: &str) -> Value {
    json!([
        {
            "type": "text",
            "text": system,
            "cache_control": { "type": "ephemeral" }
        }
    ])
}

pub fn anthropic_cached_tools(tools: &[Value]) -> Vec<Value> {
    let mut cached = tools.to_vec();
    if let Some(last) = cached.last_mut() {
        if let Some(obj) = last.as_object_mut() {
            obj.insert("cache_control".to_string(), json!({ "type": "ephemeral" }));
        }
    }
    cached
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cap_tool_output_truncates_large_payloads() {
        let huge = "x".repeat(MAX_TOOL_RESULT_CHARS + 100);
        let capped = cap_tool_output(huge);
        assert!(capped.contains("truncated"));
        assert!(capped.chars().count() <= MAX_TOOL_RESULT_CHARS + TRUNCATED_TOOL_NOTE.len());
    }

    #[test]
    fn compact_openai_replaces_old_tool_results() {
        let mut messages = vec![
            json!({"role":"system","content":"sys"}),
            json!({"role":"user","content":"task"}),
        ];
        for i in 0..20 {
            messages.push(json!({
                "role":"assistant",
                "tool_calls":[{"id":format!("c{i}"),"function":{"name":"read_file","arguments":"{}"}}]
            }));
            messages.push(json!({
                "role":"tool",
                "tool_call_id":format!("c{i}"),
                "content":"y".repeat(12_000)
            }));
        }
        compact_openai_messages(&mut messages, 2);
        let old_tool = messages[3]["content"].as_str().unwrap_or("");
        assert_eq!(old_tool, COMPACTED_TOOL_NOTE);
        let recent_tool = messages.last().unwrap()["content"].as_str().unwrap_or("");
        assert!(recent_tool.contains('y'));
    }
}
