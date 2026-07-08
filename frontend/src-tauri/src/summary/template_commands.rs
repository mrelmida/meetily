use crate::summary::templates;
use crate::summary::templates::{Template, TemplateSection, TemplateSource};
use serde::{Deserialize, Serialize};
use tauri::Runtime;
use tracing::{info, warn};

/// Template metadata for UI display
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateInfo {
    /// Template identifier (e.g., "daily_standup", "standard_meeting")
    pub id: String,

    /// Display name for the template
    pub name: String,

    /// Brief description of the template's purpose
    pub description: String,

    pub source: TemplateSource,

    pub editable: bool,

    pub deletable: bool,

    pub overrides_builtin: bool,
}

/// Detailed template structure for preview/debugging
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateDetails {
    /// Template identifier
    pub id: String,

    /// Display name
    pub name: String,

    /// Description
    pub description: String,

    /// Full section definitions in order
    pub sections: Vec<TemplateSection>,

    pub source: TemplateSource,

    pub editable: bool,

    pub deletable: bool,

    pub overrides_builtin: bool,
}

fn template_info_from_record(record: templates::TemplateRecord) -> TemplateInfo {
    TemplateInfo {
        id: record.id,
        name: record.template.name,
        description: record.template.description,
        source: record.source,
        editable: record.editable,
        deletable: record.deletable,
        overrides_builtin: record.overrides_builtin,
    }
}

fn template_details_from_record(record: templates::TemplateRecord) -> TemplateDetails {
    TemplateDetails {
        id: record.id,
        name: record.template.name,
        description: record.template.description,
        sections: record.template.sections,
        source: record.source,
        editable: record.editable,
        deletable: record.deletable,
        overrides_builtin: record.overrides_builtin,
    }
}

/// Lists all available templates
///
/// Returns templates from both built-in (embedded) and custom (user data directory) sources.
/// Templates are automatically discovered - no code changes needed to add new templates.
///
/// # Returns
/// Vector of TemplateInfo with id, name, and description for each template
#[tauri::command]
pub async fn api_list_templates<R: Runtime>(
    _app: tauri::AppHandle<R>,
) -> Result<Vec<TemplateInfo>, String> {
    info!("api_list_templates called");

    let template_infos: Vec<TemplateInfo> = templates::list_templates()
        .into_iter()
        .map(template_info_from_record)
        .collect();

    info!("Found {} available templates", template_infos.len());

    Ok(template_infos)
}

/// Gets detailed information about a specific template
///
/// # Arguments
/// * `template_id` - Template identifier (e.g., "daily_standup")
///
/// # Returns
/// TemplateDetails with full template structure
#[tauri::command]
pub async fn api_get_template_details<R: Runtime>(
    _app: tauri::AppHandle<R>,
    template_id: String,
) -> Result<TemplateDetails, String> {
    info!(
        "api_get_template_details called for template_id: {}",
        template_id
    );

    let details = template_details_from_record(templates::get_template_record(&template_id)?);

    info!("Retrieved template details for '{}'", details.name);

    Ok(details)
}

#[tauri::command]
pub async fn api_create_custom_template<R: Runtime>(
    _app: tauri::AppHandle<R>,
    template_id: String,
    template: Template,
) -> Result<TemplateInfo, String> {
    info!(
        "api_create_custom_template called for template_id: {}",
        template_id
    );

    let record = templates::write_custom_template(&template_id, &template, false)?;
    Ok(template_info_from_record(record))
}

#[tauri::command]
pub async fn api_update_custom_template<R: Runtime>(
    _app: tauri::AppHandle<R>,
    template_id: String,
    template: Template,
) -> Result<TemplateInfo, String> {
    info!(
        "api_update_custom_template called for template_id: {}",
        template_id
    );

    let normalized_id = templates::normalize_template_id(&template_id)?;
    if !templates::custom_template_exists(&normalized_id) {
        return Err(format!(
            "Template '{}' is read-only or does not exist as a custom template. Duplicate it before editing.",
            normalized_id
        ));
    }

    let record = templates::write_custom_template(&normalized_id, &template, true)?;
    Ok(template_info_from_record(record))
}

#[tauri::command]
pub async fn api_delete_custom_template<R: Runtime>(
    _app: tauri::AppHandle<R>,
    template_id: String,
) -> Result<(), String> {
    info!(
        "api_delete_custom_template called for template_id: {}",
        template_id
    );

    templates::delete_custom_template(&template_id)
}

#[tauri::command]
pub async fn api_duplicate_template<R: Runtime>(
    _app: tauri::AppHandle<R>,
    source_template_id: String,
    new_template_id: String,
    new_name: Option<String>,
) -> Result<TemplateInfo, String> {
    info!(
        "api_duplicate_template called: source='{}', destination='{}'",
        source_template_id, new_template_id
    );

    let record = templates::duplicate_template(&source_template_id, &new_template_id, new_name)?;
    Ok(template_info_from_record(record))
}

#[tauri::command]
pub async fn api_export_template<R: Runtime>(
    _app: tauri::AppHandle<R>,
    template_id: String,
) -> Result<String, String> {
    info!(
        "api_export_template called for template_id: {}",
        template_id
    );

    templates::export_template_json(&template_id)
}

#[tauri::command]
pub async fn api_import_template<R: Runtime>(
    _app: tauri::AppHandle<R>,
    template_id: String,
    template_json: String,
    overwrite: bool,
) -> Result<TemplateInfo, String> {
    info!(
        "api_import_template called for template_id: {}",
        template_id
    );

    let record = templates::import_custom_template(&template_id, &template_json, overwrite)?;
    Ok(template_info_from_record(record))
}

/// Validates a custom template JSON string
///
/// Useful for template editor UI or validation before saving custom templates
///
/// # Arguments
/// * `template_json` - Raw JSON string of the template
///
/// # Returns
/// Ok(template_name) if valid, Err(error_message) if invalid
#[tauri::command]
pub async fn api_validate_template<R: Runtime>(
    _app: tauri::AppHandle<R>,
    template_json: String,
) -> Result<String, String> {
    info!("api_validate_template called");

    match templates::validate_and_parse_template(&template_json) {
        Ok(template) => {
            info!("Template '{}' validated successfully", template.name);
            Ok(template.name)
        }
        Err(e) => {
            warn!("Template validation failed: {}", e);
            Err(e)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_list_templates() {
        // This test requires the templates to be embedded/available
        // In a real test environment, you might want to mock the templates module

        // For now, just verify the function compiles and runs
        // You can expand this with more specific assertions
    }

    #[tokio::test]
    async fn test_validate_template_valid() {
        let valid_json = r#"
        {
            "name": "Test Template",
            "description": "A test template",
            "sections": [
                {
                    "title": "Summary",
                    "instruction": "Provide a summary",
                    "format": "paragraph"
                }
            ]
        }"#;

        // Mock app handle would be needed for actual testing
        // For now, test the validation logic directly
        let result = templates::validate_and_parse_template(valid_json);
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_validate_template_invalid() {
        let invalid_json = "invalid json";

        let result = templates::validate_and_parse_template(invalid_json);
        assert!(result.is_err());
    }
}
