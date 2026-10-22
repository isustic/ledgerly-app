use crate::i18n::translate;
use rust_xlsxwriter::{Format, FormatBorder, Workbook, Image};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn export_report(
    rows: Vec<serde_json::Value>,
    columns: Vec<String>,
    template_name: Option<String>,
    chart_image: Option<Vec<u8>>,
    language: Option<String>,
    app: AppHandle,
) -> Result<String, String> {
    // Generate default filename with today's date
    let default_filename = if let Some(name) = template_name {
        // Sanitize template name for filename (replace spaces/invalid chars with underscore)
        let sanitized: String = name
            .chars()
            .map(|c| if c.is_alphanumeric() { c } else { '_' })
            .collect();
        format!("{}_{}.xlsx", sanitized, chrono::Local::now().format("%Y-%m-%d"))
    } else {
        format!("Report_{}.xlsx", chrono::Local::now().format("%Y-%m-%d"))
    };

    // Open native save dialog with default filename
    let path = app
        .dialog()
        .file()
        .add_filter(translate("Excel Spreadsheet", language.as_deref()), &["xlsx"])
        .set_file_name(&default_filename)
        .blocking_save_file()
        .ok_or("Export cancelled")?;

    let path_str = path.to_string();

    // Build Excel workbook
    let mut workbook = Workbook::new();
    let sheet = workbook.add_worksheet();

    // Bold header format
    let header_fmt = Format::new()
        .set_bold()
        .set_border(FormatBorder::Thin)
        .set_background_color(0x4472C4)
        .set_font_color(0xFFFFFF);

    let data_fmt = Format::new().set_border(FormatBorder::Thin);

    // Write headers
    for (col_idx, col_name) in columns.iter().enumerate() {
        sheet
            .write_with_format(0, col_idx as u16, col_name.as_str(), &header_fmt)
            .map_err(|e| format!("Header write error: {e}"))?;
    }

    // Write data rows
    for (row_idx, row) in rows.iter().enumerate() {
        for (col_idx, col_name) in columns.iter().enumerate() {
            let val = row.get(col_name).unwrap_or(&serde_json::Value::Null);
            match val {
                serde_json::Value::Number(n) => {
                    if let Some(f) = n.as_f64() {
                        sheet
                            .write_with_format(row_idx as u32 + 1, col_idx as u16, f, &data_fmt)
                            .map_err(|e| format!("Write error: {e}"))?;
                    }
                }
                serde_json::Value::String(s) => {
                    sheet
                        .write_with_format(row_idx as u32 + 1, col_idx as u16, s.as_str(), &data_fmt)
                        .map_err(|e| format!("Write error: {e}"))?;
                }
                serde_json::Value::Null => {}
                other => {
                    sheet
                        .write_with_format(row_idx as u32 + 1, col_idx as u16, other.to_string().as_str(), &data_fmt)
                        .map_err(|e| format!("Write error: {e}"))?;
                }
            }
        }
    }

    // Auto-fit columns
    sheet.autofit();

    // Add chart image if provided
    if let Some(image_data) = chart_image {
        println!("📊 Chart image received: {} bytes", image_data.len());

        // Calculate position for chart (below the table)
        let table_end_row = (rows.len() + 3) as u32; // +3 for headers and spacing

        // Create a temporary file for the image
        let temp_image_path = format!(
            "{}/chart_export_{}.png",
            std::env::temp_dir().display(),
            chrono::Local::now().format("%Y%m%d_%H%M%S_%3f")
        );

        println!("💾 Writing chart to temp file: {}", temp_image_path);

        // Write image data to temp file
        std::fs::write(&temp_image_path, &image_data)
            .map_err(|e| {
                println!("❌ Failed to write chart image: {}", e);
                format!("Failed to write chart image: {e}")
            })?;

        println!("✅ Chart image written successfully");

        // Verify it's a valid PNG by checking the header
        let file_contents = std::fs::read(&temp_image_path)
            .map_err(|e| format!("Failed to read temp file: {e}"))?;

        if file_contents.len() < 8 {
            return Err("Image file too small to be valid".to_string());
        }

        // PNG header: 137 80 78 71 13 10 26 10
        let png_header: [u8; 8] = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        if &file_contents[0..8] != &png_header {
            println!("⚠️ Warning: File doesn't start with PNG header");
            println!("First 8 bytes: {:02X?}", &file_contents[0..8]);
        } else {
            println!("✅ PNG header verified");
        }

        // Create image and handle the Result
        let img = Image::new(&temp_image_path)
            .map_err(|e| {
                println!("❌ Failed to create image object: {}", e);
                format!("Failed to create image: {e}")
            })?;

        println!("🖼️ Image object created, dimensions: {}x{}", img.width(), img.height());

        // Set image scale to make it fit better
        let img = img.set_scale_width(0.5).set_scale_height(0.5);

        // Add image to worksheet - try moving it 2 rows down for better visibility
        let image_row = table_end_row + 2;
        sheet
            .insert_image(image_row, 0, &img)
            .map_err(|e| {
                println!("❌ Failed to insert image in sheet: {}", e);
                format!("Failed to add chart image: {e}")
            })?;

        println!("✅ Chart inserted successfully at row {} with scale 0.5", image_row);

        // Clean up temp file
        let _ = std::fs::remove_file(&temp_image_path);
    } else {
        println!("⚠️ No chart image provided");
    }

    workbook
        .save(&path_str)
        .map_err(|e| format!("Save error: {e}"))?;

    Ok(path_str)
}
