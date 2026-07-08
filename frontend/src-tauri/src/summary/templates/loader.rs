use super::defaults;
use super::types::{Template, TemplateSource};
use once_cell::sync::Lazy;
use std::fs;
use std::path::PathBuf;
use std::sync::RwLock;
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::{debug, info, warn};

// Global storage for the bundled templates directory path
static BUNDLED_TEMPLATES_DIR: Lazy<RwLock<Option<PathBuf>>> = Lazy::new(|| RwLock::new(None));

#[derive(Debug, Clone)]
pub struct TemplateRecord {
    pub id: String,
    pub template: Template,
    pub source: TemplateSource,
    pub editable: bool,
    pub deletable: bool,
    pub overrides_builtin: bool,
}

/// Set the bundled templates directory path (called once at app startup)
pub fn set_bundled_templates_dir(path: PathBuf) {
    info!("Bundled templates directory set to: {:?}", path);
    if let Ok(mut dir) = BUNDLED_TEMPLATES_DIR.write() {
        *dir = Some(path);
    }
}

/// Get the user's custom templates directory path
///
/// Returns the platform-specific application data directory for custom templates:
/// - macOS: ~/Library/Application Support/Meetily/templates/
/// - Windows: %APPDATA%\Meetily\templates\
/// - Linux: ~/.config/Meetily/templates/
pub fn get_custom_templates_dir() -> Option<PathBuf> {
    let mut path = dirs::data_dir()?;
    path.push("Meetily");
    path.push("templates");
    Some(path)
}

pub fn normalize_template_id(template_id: &str) -> Result<String, String> {
    let mut normalized = String::new();
    let mut previous_was_separator = false;

    for character in template_id.trim().to_ascii_lowercase().chars() {
        if character.is_ascii_alphanumeric() {
            normalized.push(character);
            previous_was_separator = false;
        } else if character == '_' || character.is_ascii_whitespace() {
            if !previous_was_separator && !normalized.is_empty() {
                normalized.push('_');
                previous_was_separator = true;
            }
        } else if character == '-' {
            if !previous_was_separator && !normalized.is_empty() {
                normalized.push('-');
                previous_was_separator = true;
            }
        } else {
            return Err(
                "Template ID can only contain letters, numbers, spaces, hyphens, and underscores"
                    .to_string(),
            );
        }
    }

    let normalized = normalized
        .trim_matches(|character| character == '_' || character == '-')
        .to_string();

    if normalized.is_empty() {
        Err("Template ID cannot be empty".to_string())
    } else {
        Ok(normalized)
    }
}

fn custom_template_path(template_id: &str) -> Result<PathBuf, String> {
    let normalized_id = normalize_template_id(template_id)?;
    let custom_dir = get_custom_templates_dir()
        .ok_or_else(|| "Could not resolve custom templates directory".to_string())?;

    Ok(custom_dir.join(format!("{}.json", normalized_id)))
}

fn template_id_from_filename(filename: &str, source: TemplateSource) -> Option<String> {
    if !filename.ends_with(".json") {
        return None;
    }

    let id = filename.trim_end_matches(".json").to_string();
    match normalize_template_id(&id) {
        Ok(normalized) if normalized == id => Some(id),
        Ok(normalized) => {
            warn!(
                "Skipping {:?} template '{}' because it normalizes to '{}'",
                source, id, normalized
            );
            None
        }
        Err(e) => {
            warn!("Skipping {:?} template '{}': {}", source, id, e);
            None
        }
    }
}

/// Load a template from the bundled resources directory
///
/// # Arguments
/// * `template_id` - Template identifier (without .json extension)
///
/// # Returns
/// The template JSON content if found, None otherwise
fn load_bundled_template(template_id: &str) -> Option<String> {
    let template_id = normalize_template_id(template_id).ok()?;
    let bundled_dir = BUNDLED_TEMPLATES_DIR.read().ok()?.clone()?;
    let template_path = bundled_dir.join(format!("{}.json", template_id));

    debug!("Checking for bundled template at: {:?}", template_path);

    match std::fs::read_to_string(&template_path) {
        Ok(content) => {
            info!(
                "Loaded bundled template '{}' from {:?}",
                template_id, template_path
            );
            Some(content)
        }
        Err(e) => {
            debug!("No bundled template '{}' found: {}", template_id, e);
            None
        }
    }
}

/// Load a template from the user's custom templates directory
///
/// # Arguments
/// * `template_id` - Template identifier (without .json extension)
///
/// # Returns
/// The template JSON content if found, None otherwise
fn load_custom_template(template_id: &str) -> Option<String> {
    let template_id = normalize_template_id(template_id).ok()?;
    let custom_dir = get_custom_templates_dir()?;
    let template_path = custom_dir.join(format!("{}.json", template_id));

    debug!("Checking for custom template at: {:?}", template_path);

    match std::fs::read_to_string(&template_path) {
        Ok(content) => {
            info!(
                "Loaded custom template '{}' from {:?}",
                template_id, template_path
            );
            Some(content)
        }
        Err(e) => {
            debug!("No custom template '{}' found: {}", template_id, e);
            None
        }
    }
}

pub fn custom_template_exists(template_id: &str) -> bool {
    custom_template_path(template_id)
        .map(|path| path.exists())
        .unwrap_or(false)
}

fn bundled_template_exists(template_id: &str) -> bool {
    let Ok(template_id) = normalize_template_id(template_id) else {
        return false;
    };

    let Some(bundled_dir) = BUNDLED_TEMPLATES_DIR
        .read()
        .ok()
        .and_then(|dir| dir.clone())
    else {
        return false;
    };

    bundled_dir.join(format!("{}.json", template_id)).exists()
}

fn shipped_template_exists(template_id: &str) -> bool {
    let Ok(template_id) = normalize_template_id(template_id) else {
        return false;
    };

    defaults::get_builtin_template(&template_id).is_some() || bundled_template_exists(&template_id)
}

fn template_record_from_content(
    template_id: &str,
    json_content: &str,
    source: TemplateSource,
) -> Result<TemplateRecord, String> {
    let id = normalize_template_id(template_id)?;
    let template = validate_and_parse_template(json_content)?;
    let is_custom = source == TemplateSource::Custom;

    Ok(TemplateRecord {
        id: id.clone(),
        template,
        source,
        editable: is_custom,
        deletable: is_custom,
        overrides_builtin: is_custom && shipped_template_exists(&id),
    })
}

/// Load and parse a template by identifier
///
/// This function implements a fallback strategy:
/// 1. Check user's custom templates directory
/// 2. Check bundled resources directory (app templates)
/// 3. Fall back to built-in embedded templates
/// 4. Return error if not found in any location
///
/// # Arguments
/// * `template_id` - Template identifier (e.g., "daily_standup", "standard_meeting")
///
/// # Returns
/// Parsed and validated Template struct
pub fn get_template(template_id: &str) -> Result<Template, String> {
    Ok(get_template_record(template_id)?.template)
}

pub fn get_template_record(template_id: &str) -> Result<TemplateRecord, String> {
    let template_id = normalize_template_id(template_id)?;
    info!("Loading template: {}", template_id);

    // Try custom template first, then bundled, then built-in
    let (json_content, source) = if let Some(custom_content) = load_custom_template(&template_id) {
        debug!("Using custom template for '{}'", template_id);
        (custom_content, TemplateSource::Custom)
    } else if let Some(bundled_content) = load_bundled_template(&template_id) {
        debug!("Using bundled template for '{}'", template_id);
        (bundled_content, TemplateSource::Bundled)
    } else if let Some(builtin_content) = defaults::get_builtin_template(&template_id) {
        debug!("Using built-in template for '{}'", template_id);
        (builtin_content.to_string(), TemplateSource::Builtin)
    } else {
        return Err(format!(
            "Template '{}' not found. Available templates: {}",
            template_id,
            list_template_ids().join(", ")
        ));
    };

    template_record_from_content(&template_id, &json_content, source)
}

/// Validate and parse template JSON
///
/// # Arguments
/// * `json_content` - Raw JSON string
///
/// # Returns
/// Parsed and validated Template struct
pub fn validate_and_parse_template(json_content: &str) -> Result<Template, String> {
    let template: Template = serde_json::from_str(json_content)
        .map_err(|e| format!("Failed to parse template JSON: {}", e))?;

    template.validate()?;

    Ok(template)
}

pub fn serialize_template(template: &Template) -> Result<String, String> {
    template.validate()?;
    serde_json::to_string_pretty(template)
        .map_err(|e| format!("Failed to serialize template JSON: {}", e))
}

pub fn write_custom_template(
    template_id: &str,
    template: &Template,
    overwrite: bool,
) -> Result<TemplateRecord, String> {
    let template_id = normalize_template_id(template_id)?;
    let custom_dir = get_custom_templates_dir()
        .ok_or_else(|| "Could not resolve custom templates directory".to_string())?;
    let template_path = custom_dir.join(format!("{}.json", template_id));

    if template_path.exists() && !overwrite {
        return Err(format!("Custom template '{}' already exists", template_id));
    }

    fs::create_dir_all(&custom_dir)
        .map_err(|e| format!("Failed to create custom templates directory: {}", e))?;

    let json_content = serialize_template(template)?;
    validate_and_parse_template(&json_content)?;

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    let temp_path = custom_dir.join(format!(".{}.{}.tmp", template_id, timestamp));

    fs::write(&temp_path, json_content)
        .map_err(|e| format!("Failed to write temporary template file: {}", e))?;

    if template_path.exists() {
        fs::remove_file(&template_path)
            .map_err(|e| format!("Failed to replace existing template: {}", e))?;
    }

    if let Err(e) = fs::rename(&temp_path, &template_path) {
        let _ = fs::remove_file(&temp_path);
        return Err(format!("Failed to save template '{}': {}", template_id, e));
    }

    get_template_record(&template_id)
}

pub fn delete_custom_template(template_id: &str) -> Result<(), String> {
    let template_id = normalize_template_id(template_id)?;
    let template_path = custom_template_path(&template_id)?;

    if !template_path.exists() {
        return Err(format!("Custom template '{}' does not exist", template_id));
    }

    fs::remove_file(&template_path)
        .map_err(|e| format!("Failed to delete template '{}': {}", template_id, e))
}

pub fn export_template_json(template_id: &str) -> Result<String, String> {
    let record = get_template_record(template_id)?;
    serialize_template(&record.template)
}

pub fn import_custom_template(
    template_id: &str,
    template_json: &str,
    overwrite: bool,
) -> Result<TemplateRecord, String> {
    let template = validate_and_parse_template(template_json)?;
    write_custom_template(template_id, &template, overwrite)
}

pub fn duplicate_template(
    source_template_id: &str,
    new_template_id: &str,
    new_name: Option<String>,
) -> Result<TemplateRecord, String> {
    let mut template = get_template(source_template_id)?;

    if let Some(name) = new_name {
        if !name.trim().is_empty() {
            template.name = name.trim().to_string();
        }
    }

    write_custom_template(new_template_id, &template, false)
}

/// List all available template identifiers
///
/// Returns a combined list of:
/// - Built-in template IDs
/// - Bundled template IDs (from app resources)
/// - Custom template IDs (from user's data directory)
pub fn list_template_ids() -> Vec<String> {
    let mut ids: Vec<String> = defaults::list_builtin_template_ids()
        .into_iter()
        .map(|s| s.to_string())
        .collect();

    // Add bundled templates if directory is set
    if let Ok(bundled_dir_lock) = BUNDLED_TEMPLATES_DIR.read() {
        if let Some(bundled_dir) = bundled_dir_lock.as_ref() {
            if bundled_dir.exists() {
                match std::fs::read_dir(bundled_dir) {
                    Ok(entries) => {
                        for entry in entries.flatten() {
                            if let Some(filename) = entry.file_name().to_str() {
                                if let Some(id) =
                                    template_id_from_filename(filename, TemplateSource::Bundled)
                                {
                                    if !ids.contains(&id) {
                                        ids.push(id);
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        warn!("Failed to read bundled templates directory: {}", e);
                    }
                }
            }
        }
    }

    // Add custom templates if directory exists
    if let Some(custom_dir) = get_custom_templates_dir() {
        if custom_dir.exists() {
            match std::fs::read_dir(&custom_dir) {
                Ok(entries) => {
                    for entry in entries.flatten() {
                        if let Some(filename) = entry.file_name().to_str() {
                            if let Some(id) =
                                template_id_from_filename(filename, TemplateSource::Custom)
                            {
                                if !ids.contains(&id) {
                                    ids.push(id);
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    warn!("Failed to read custom templates directory: {}", e);
                }
            }
        }
    }

    ids.sort();
    ids
}

/// List all available templates with their metadata
///
/// Returns a list of template records
pub fn list_templates() -> Vec<TemplateRecord> {
    let mut templates = Vec::new();

    for id in list_template_ids() {
        match get_template_record(&id) {
            Ok(record) => {
                templates.push(record);
            }
            Err(e) => {
                warn!("Failed to load template '{}': {}", id, e);
            }
        }
    }

    templates
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_builtin_template() {
        let template = get_template("daily_standup");
        assert!(template.is_ok());

        let template = template.unwrap();
        assert_eq!(template.name, "Daily Standup");
        assert!(!template.sections.is_empty());
    }

    #[test]
    fn test_get_nonexistent_template() {
        let result = get_template("nonexistent_template");
        assert!(result.is_err());
    }

    #[test]
    fn test_list_template_ids() {
        let ids = list_template_ids();
        assert!(ids.contains(&"daily_standup".to_string()));
        assert!(ids.contains(&"standard_meeting".to_string()));
    }

    #[test]
    fn test_validate_invalid_json() {
        let result = validate_and_parse_template("invalid json");
        assert!(result.is_err());
    }
}
