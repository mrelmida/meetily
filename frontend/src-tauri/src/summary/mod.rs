/// Summary module - handles all meeting summary generation functionality
///
/// This module contains:
/// - LLM client for communicating with various AI providers (OpenAI, Claude, Groq, Ollama, OpenRouter, CustomOpenAI)
/// - Processor for chunking transcripts and generating summaries
/// - Service layer for orchestrating summary generation
/// - Templates for structured meeting summary generation
/// - Tauri commands for frontend integration

use serde::{Deserialize, Serialize};

/// Custom OpenAI-compatible endpoint configuration
/// Stored as JSON in the database and used for connecting to any OpenAI-compatible API server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomOpenAIConfig {
    /// Base URL of the OpenAI-compatible API endpoint (e.g., "http://localhost:8000/v1")
    pub endpoint: String,
    /// API key for authentication (optional if server doesn't require it)
    #[serde(rename = "apiKey")]
    pub api_key: Option<String>,
    /// Model identifier to use (e.g., "gpt-4", "llama-3-70b", "mistral-7b")
    pub model: String,
    /// Maximum tokens for completion (optional)
    #[serde(rename = "maxTokens")]
    pub max_tokens: Option<i32>,
    /// Temperature parameter (0.0-2.0, optional)
    pub temperature: Option<f32>,
    /// Top-P sampling parameter (0.0-1.0, optional)
    #[serde(rename = "topP")]
    pub top_p: Option<f32>,
}

pub fn custom_openai_chat_completions_url(endpoint: &str) -> Result<String, String> {
    let trimmed = endpoint.trim();

    if trimmed.is_empty() {
        return Err("Endpoint URL is required".to_string());
    }

    if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        return Err("Endpoint must start with http:// or https://".to_string());
    }

    let normalized = trimmed.trim_end_matches('/');
    let is_chat_completions_url = normalized.to_ascii_lowercase().ends_with("/chat/completions");

    if is_chat_completions_url {
        Ok(normalized.to_string())
    } else {
        Ok(format!("{}/chat/completions", normalized))
    }
}

pub mod commands;
pub(crate) mod language_detection;
pub mod llm_client;
pub(crate) mod metadata;
pub mod processor;
pub mod service;
pub mod summary_engine;
pub mod template_commands;
pub mod templates;

// Re-export Tauri commands (with their generated __cmd__ variants)
pub use commands::{
    __cmd__api_cancel_summary, __cmd__api_detect_transcript_summary_language,
    __cmd__api_get_meeting_detected_summary_language, __cmd__api_get_meeting_summary_language,
    __cmd__api_get_summary, __cmd__api_process_transcript,
    __cmd__api_save_meeting_detected_summary_language, __cmd__api_save_meeting_summary,
    __cmd__api_save_meeting_summary_language, __tauri_command_name_api_cancel_summary,
    __tauri_command_name_api_detect_transcript_summary_language,
    __tauri_command_name_api_get_meeting_detected_summary_language,
    __tauri_command_name_api_get_meeting_summary_language,
    __tauri_command_name_api_get_summary, __tauri_command_name_api_process_transcript,
    __tauri_command_name_api_save_meeting_detected_summary_language,
    __tauri_command_name_api_save_meeting_summary,
    __tauri_command_name_api_save_meeting_summary_language, api_cancel_summary,
    api_detect_transcript_summary_language, api_get_meeting_detected_summary_language,
    api_get_meeting_summary_language, api_get_summary, api_process_transcript,
    api_save_meeting_detected_summary_language, api_save_meeting_summary,
    api_save_meeting_summary_language,
};

// Re-export template commands
pub use template_commands::{
    __cmd__api_get_template_details, __cmd__api_list_templates, __cmd__api_validate_template,
    __tauri_command_name_api_get_template_details, __tauri_command_name_api_list_templates,
    __tauri_command_name_api_validate_template,
    api_get_template_details, api_list_templates, api_validate_template,
};

// Re-export commonly used items
pub use llm_client::LLMProvider;
pub use processor::{
    chunk_text, clean_llm_markdown_output, extract_meeting_name_from_markdown,
    generate_meeting_summary, rough_token_count,
};
pub use service::SummaryService;

#[cfg(test)]
mod tests {
    use super::custom_openai_chat_completions_url;

    #[test]
    fn custom_openai_url_appends_chat_completions_to_base_url() {
        let url = custom_openai_chat_completions_url("http://localhost:8000/v1").unwrap();

        assert_eq!(url, "http://localhost:8000/v1/chat/completions");
    }

    #[test]
    fn custom_openai_url_trims_spaces_and_trailing_slashes() {
        let url = custom_openai_chat_completions_url("  https://api.example.com/v1///  ").unwrap();

        assert_eq!(url, "https://api.example.com/v1/chat/completions");
    }

    #[test]
    fn custom_openai_url_accepts_full_chat_completions_url() {
        let url =
            custom_openai_chat_completions_url("https://api.example.com/v1/chat/completions/")
                .unwrap();

        assert_eq!(url, "https://api.example.com/v1/chat/completions");
    }

    #[test]
    fn custom_openai_url_rejects_empty_endpoint() {
        let err = custom_openai_chat_completions_url("   ").unwrap_err();

        assert_eq!(err, "Endpoint URL is required");
    }

    #[test]
    fn custom_openai_url_rejects_non_http_endpoint() {
        let err = custom_openai_chat_completions_url("localhost:8000/v1").unwrap_err();

        assert_eq!(err, "Endpoint must start with http:// or https://");
    }
}
