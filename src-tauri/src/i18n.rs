use std::collections::HashMap;
use std::sync::OnceLock;

// Share the UI catalogs so native export dialogs and generated report labels use the same copy.
pub fn translate(source: &str, language: Option<&str>) -> String {
    static EN: OnceLock<HashMap<String, String>> = OnceLock::new();
    static RO: OnceLock<HashMap<String, String>> = OnceLock::new();
    let catalog = if language == Some("ro") {
        RO.get_or_init(|| serde_json::from_str(include_str!("../../lib/i18n/ro.json")).expect("valid Romanian catalog"))
    } else {
        EN.get_or_init(|| serde_json::from_str(include_str!("../../lib/i18n/en.json")).expect("valid English catalog"))
    };
    catalog.get(source).cloned().unwrap_or_else(|| source.to_owned())
}
