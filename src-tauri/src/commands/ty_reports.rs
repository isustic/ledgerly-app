use crate::db::{
    schema::{create_dataset_table, infer_type, sanitize_col_name, ColDef},
    DbState,
};
use calamine::{open_workbook, Data, Reader, Xlsx};
use chrono::{Datelike, NaiveDate, Utc};
use rusqlite::{params, types::Value};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct TyReportInfo {
    pub id: i64,
    pub name: String,
    pub original_file_name: String,
    pub file_path: String,
    pub table_name: String,
    pub row_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TyColumnMeta {
    pub id: i64,
    pub report_id: i64,
    pub name: String,
    pub display_name: Option<String>,
    pub col_type: String,
    pub display_order: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PagedRows {
    pub rows: Vec<serde_json::Value>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

fn excel_serial_to_yyyymmdd(excel_date: f64) -> String {
    if excel_date < 1.0 {
        return String::new();
    }
    let days_since_epoch = excel_date as i64 - 2;
    if let Some(excel_epoch) = NaiveDate::from_ymd_opt(1900, 1, 1) {
        if let Some(date) = excel_epoch.checked_add_signed(chrono::Duration::days(days_since_epoch)) {
            return format!("{:04}{:02}{:02}", date.year(), date.month(), date.day());
        }
    }
    excel_date.to_string()
}

fn cell_to_string(cell: &Data) -> String {
    match cell {
        Data::Empty => String::new(),
        Data::String(s) | Data::DateTimeIso(s) | Data::DurationIso(s) => s.clone(),
        Data::Float(f) => {
            if f.fract() == 0.0 && f.abs() < (i64::MAX as f64) {
                (*f as i64).to_string()
            } else {
                f.to_string()
            }
        }
        Data::Int(i) => i.to_string(),
        Data::Bool(b) => b.to_string(),
        Data::Error(e) => format!("{e:?}"),
        Data::DateTime(dt) => excel_serial_to_yyyymmdd(dt.as_f64()),
    }
}

fn to_table_name(report_id: i64, timestamp: &str) -> String {
    let date_part = timestamp[..10.min(timestamp.len())].replace('-', "");
    format!("ty_report_{}_{}", date_part, report_id)
}

fn parse_cell_for_column(raw: &str, col_type: &str) -> Value {
    match col_type.to_uppercase().as_str() {
        "INTEGER" => raw
            .parse::<i64>()
            .map(Value::Integer)
            .unwrap_or_else(|_| Value::Text(raw.to_string())),
        "REAL" => raw
            .parse::<f64>()
            .map(|f| Value::Real((f * 100.0).round() / 100.0))
            .unwrap_or_else(|_| Value::Text(raw.to_string())),
        _ => Value::Text(raw.to_string()),
    }
}

fn value_to_json(val: Value) -> serde_json::Value {
    match val {
        Value::Null => serde_json::Value::Null,
        Value::Integer(n) => serde_json::Value::Number(n.into()),
        Value::Real(f) => {
            let rounded = (f * 100.0).round() / 100.0;
            serde_json::Value::Number(serde_json::Number::from_f64(rounded).unwrap_or(0.into()))
        }
        Value::Text(s) => serde_json::Value::String(s),
        Value::Blob(_) => serde_json::Value::String("[blob]".into()),
    }
}

/// Escape special LIKE characters.
fn escape_like(query: &str) -> String {
    query.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_")
}

#[tauri::command]
pub async fn import_ty_report(
    path: String,
    report_name: String,
    db: State<'_, DbState>,
) -> Result<TyReportInfo, String> {
    let path_for_thread = path.clone();
    let name_for_thread = report_name.clone();

    let (headers, data_rows) = tokio::task::spawn_blocking(
        move || -> Result<(Vec<String>, Vec<Vec<String>>), String> {
            let mut workbook: Xlsx<_> = open_workbook(&path_for_thread)
                .map_err(|e| format!("Failed to open file: {e}"))?;
            let sheet_name = workbook
                .sheet_names()
                .first()
                .cloned()
                .ok_or("No sheets found")?;
            let range = workbook
                .worksheet_range(&sheet_name)
                .map_err(|e| format!("Failed to read sheet: {e}"))?;

            let mut rows = range.rows();
            let headers_raw: Vec<String> = rows
                .next()
                .ok_or("Sheet is empty")?
                .iter()
                .map(|c| cell_to_string(c).trim().to_string())
                .collect();

            let max_cols = headers_raw.len();
            let headers: Vec<String> = headers_raw
                .into_iter()
                .enumerate()
                .map(|(i, h)| {
                    if h.is_empty() {
                        format!("column_{}", i + 1)
                    } else {
                        h
                    }
                })
                .collect();

            let data_rows: Vec<Vec<String>> = rows
                .map(|row| {
                    let mut cells: Vec<String> = row.iter().map(cell_to_string).collect();
                    while cells.len() < max_cols {
                        cells.push(String::new());
                    }
                    cells.truncate(max_cols);
                    cells
                })
                .collect();

            Ok((headers, data_rows))
        },
    )
    .await
    .map_err(|e| format!("Task join error: {e}"))??;

    let total_rows = data_rows.len();
    let timestamp = Utc::now().to_rfc3339();
    let original_file_name = std::path::Path::new(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(&name_for_thread)
        .to_string();

    let conn = db.0.lock().map_err(|_| "DB lock error")?;

    conn.execute(
        "INSERT INTO ty_reports (name, original_file_name, file_path, table_name, row_count, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6)",
        params![report_name, original_file_name, path, "", timestamp, timestamp],
    )
    .map_err(|e| format!("DB insert error: {e}"))?;

    let report_id = conn.last_insert_rowid();
    let table_name = to_table_name(report_id, &timestamp);

    conn.execute(
        "UPDATE ty_reports SET table_name = ?1 WHERE id = ?2",
        params![&table_name, report_id],
    )
    .map_err(|e| format!("Update table name error: {e}"))?;

    let col_defs: Vec<ColDef> = headers
        .iter()
        .enumerate()
        .map(|(i, name)| {
            let sample = data_rows
                .iter()
                .take(50)
                .find_map(|r| r.get(i).filter(|v| !v.is_empty()).cloned())
                .unwrap_or_default();
            ColDef {
                name: name.clone(),
                col_type: infer_type(&sample).to_string(),
            }
        })
        .collect();

    create_dataset_table(&conn, &table_name, &col_defs)
        .map_err(|e| format!("Schema error: {e}"))?;

    for (i, col) in col_defs.iter().enumerate() {
        let sanitized = sanitize_col_name(&col.name);
        conn.execute(
            "INSERT INTO ty_report_columns (report_id, name, display_name, col_type, display_order)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![report_id, sanitized, col.name, col.col_type, i as i64],
        )
        .map_err(|e| format!("Column meta error: {e}"))?;
    }

    let batch_size = 1000;
    let col_names_sql: Vec<String> = col_defs
        .iter()
        .map(|c| format!("\"{}\"", sanitize_col_name(&c.name)))
        .collect();
    let placeholders: Vec<String> = (1..=col_names_sql.len()).map(|i| format!("?{i}")).collect();
    let insert_sql = format!(
        "INSERT INTO \"{}\" ({}) VALUES ({})",
        sanitize_col_name(&table_name),
        col_names_sql.join(", "),
        placeholders.join(", ")
    );

    for chunk in data_rows.chunks(batch_size) {
        let tx = conn
            .unchecked_transaction()
            .map_err(|e| format!("Transaction error: {e}"))?;
        {
            let mut stmt = tx
                .prepare(&insert_sql)
                .map_err(|e| format!("Prepare error: {e}"))?;
            for row in chunk {
                let values: Vec<Value> = row
                    .iter()
                    .enumerate()
                    .map(|(i, v)| parse_cell_for_column(v, &col_defs[i].col_type))
                    .collect();
                stmt.execute(rusqlite::params_from_iter(values.iter()))
                    .map_err(|e| format!("Insert error: {e}"))?;
            }
        }
        tx.commit().map_err(|e| format!("Commit error: {e}"))?;
    }

    conn.execute(
        "UPDATE ty_reports SET row_count = ?1 WHERE id = ?2",
        params![total_rows as i64, report_id],
    )
    .map_err(|e| format!("Update row count error: {e}"))?;

    Ok(TyReportInfo {
        id: report_id,
        name: report_name,
        original_file_name: name_for_thread,
        file_path: path,
        table_name,
        row_count: total_rows as i64,
        created_at: timestamp.clone(),
        updated_at: timestamp,
    })
}

#[tauri::command]
pub fn list_ty_reports(db: State<'_, DbState>) -> Result<Vec<TyReportInfo>, String> {
    let conn = db.0.lock().map_err(|_| "DB lock error")?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, original_file_name, file_path, table_name, row_count, created_at, updated_at
             FROM ty_reports ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let reports = stmt
        .query_map([], |row| {
            Ok(TyReportInfo {
                id: row.get(0)?,
                name: row.get(1)?,
                original_file_name: row.get(2)?,
                file_path: row.get(3)?,
                table_name: row.get(4)?,
                row_count: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(reports)
}

#[tauri::command]
pub fn rename_ty_report(report_id: i64, name: String, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|_| "DB lock error")?;
    let updated_at = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE ty_reports SET name = ?1, updated_at = ?2 WHERE id = ?3",
        params![name, updated_at, report_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_ty_report(report_id: i64, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|_| "DB lock error")?;
    let table_name: String = conn
        .query_row(
            "SELECT table_name FROM ty_reports WHERE id = ?1",
            params![report_id],
            |r| r.get(0),
        )
        .map_err(|e| format!("Report not found: {e}"))?;

    let safe_table = sanitize_col_name(&table_name);
    conn.execute_batch(&format!("DROP TABLE IF EXISTS \"{safe_table}\";"))
        .map_err(|e| format!("Drop table error: {e}"))?;
    conn.execute(
        "DELETE FROM ty_report_columns WHERE report_id = ?1",
        params![report_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM ty_reports WHERE id = ?1", params![report_id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_ty_report_columns(
    report_id: i64,
    db: State<'_, DbState>,
) -> Result<Vec<TyColumnMeta>, String> {
    let conn = db.0.lock().map_err(|_| "DB lock error")?;
    let mut stmt = conn
        .prepare(
            "SELECT id, report_id, name, display_name, col_type, display_order
             FROM ty_report_columns WHERE report_id = ?1 ORDER BY display_order",
        )
        .map_err(|e| e.to_string())?;

    let cols = stmt
        .query_map(params![report_id], |row| {
            Ok(TyColumnMeta {
                id: row.get(0)?,
                report_id: row.get(1)?,
                name: row.get(2)?,
                display_name: row.get(3)?,
                col_type: row.get(4)?,
                display_order: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(cols)
}

#[tauri::command]
pub async fn get_ty_report_rows(
    report_id: i64,
    page: i64,
    page_size: i64,
    search: Option<String>,
    app: AppHandle,
) -> Result<PagedRows, String> {
    tauri::async_runtime::spawn_blocking(move || get_ty_report_rows_sync(report_id, page, page_size, search, app.state::<DbState>()))
        .await
        .map_err(|e| e.to_string())?
}

fn get_ty_report_rows_sync(
    report_id: i64,
    page: i64,
    page_size: i64,
    search: Option<String>,
    db: State<'_, DbState>,
) -> Result<PagedRows, String> {
    let conn = db.0.lock().map_err(|_| "DB lock error")?;

    let (table_name, columns) = load_report_columns(&conn, report_id)?;
    let safe_table = sanitize_col_name(&table_name);
    let offset = page * page_size;

    let text_columns: Vec<String> = columns
        .iter()
        .filter(|(_, col_type)| col_type == "TEXT")
        .map(|(name, _)| name.clone())
        .collect();

    let query = search.unwrap_or_default();
    let use_search = !query.trim().is_empty() && !text_columns.is_empty();

    let (total, rows) = if use_search {
        let escaped = escape_like(&query);
        let pattern = format!("%{escaped}%");
        let where_clauses: Vec<String> = text_columns
            .iter()
            .map(|col| format!(r#""{col}" LIKE ?1 ESCAPE '\'"#))
            .collect();
        let where_clause = where_clauses.join(" OR ");

        let count_sql = format!("SELECT COUNT(*) FROM \"{safe_table}\" WHERE {where_clause}");
        let total: i64 = conn
            .query_row(&count_sql, params![&pattern], |r| r.get(0))
            .map_err(|e| e.to_string())?;

        let sql = format!(
            "SELECT * FROM \"{safe_table}\" WHERE {where_clause} LIMIT ?2 OFFSET ?3"
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let col_count = stmt.column_count();
        let col_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

        let rows = stmt
            .query_map(params![&pattern, page_size, offset], |row| {
                Ok(row_to_json(row, col_count, &col_names)?)
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        (total, rows)
    } else {
        let total: i64 = conn
            .query_row(&format!("SELECT COUNT(*) FROM \"{safe_table}\""), [], |r| r.get(0))
            .map_err(|e| e.to_string())?;

        let sql = format!("SELECT * FROM \"{safe_table}\" LIMIT ?1 OFFSET ?2");
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let col_count = stmt.column_count();
        let col_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

        let rows = stmt
            .query_map(params![page_size, offset], |row| {
                Ok(row_to_json(row, col_count, &col_names)?)
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        (total, rows)
    };

    Ok(PagedRows {
        rows,
        total,
        page,
        page_size,
    })
}

fn load_report_columns(
    conn: &rusqlite::Connection,
    report_id: i64,
) -> Result<(String, Vec<(String, String)>), String> {
    let table_name: String = conn
        .query_row(
            "SELECT table_name FROM ty_reports WHERE id = ?1",
            params![report_id],
            |r| r.get(0),
        )
        .map_err(|e| format!("Report not found: {e}"))?;

    let mut stmt = conn
        .prepare("SELECT name, col_type FROM ty_report_columns WHERE report_id = ?1 ORDER BY display_order")
        .map_err(|e| e.to_string())?;

    let columns = stmt
        .query_map(params![report_id], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok((table_name, columns))
}

fn row_to_json(
    row: &rusqlite::Row,
    col_count: usize,
    col_names: &[String],
) -> Result<serde_json::Value, rusqlite::Error> {
    let mut map = serde_json::Map::new();
    for i in 0..col_count {
        let val: Value = row.get(i)?;
        map.insert(col_names[i].clone(), value_to_json(val));
    }
    Ok(serde_json::Value::Object(map))
}

#[tauri::command]
pub fn update_ty_report_row(
    report_id: i64,
    row_id: i64,
    values: HashMap<String, String>,
    db: State<'_, DbState>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|_| "DB lock error")?;
    let (table_name, columns) = load_report_columns(&conn, report_id)?;

    let col_type_map: HashMap<String, String> = columns.into_iter().collect();
    let safe_table = sanitize_col_name(&table_name);

    let mut set_clauses: Vec<String> = Vec::new();
    let mut params: Vec<Value> = Vec::new();

    for (raw_col, raw_val) in values {
        let safe_col = sanitize_col_name(&raw_col);
        let col_type = col_type_map
            .get(&safe_col)
            .ok_or_else(|| format!("Invalid column: {raw_col}"))?;
        set_clauses.push(format!("\"{}\" = ?", safe_col));
        params.push(parse_cell_for_column(&raw_val, col_type));
    }

    if set_clauses.is_empty() {
        return Ok(());
    }

    params.push(Value::Integer(row_id));
    let sql = format!(
        "UPDATE \"{}\" SET {} WHERE _row_id = ?",
        safe_table,
        set_clauses.join(", ")
    );

    conn.execute(&sql, rusqlite::params_from_iter(params.iter()))
        .map_err(|e| format!("Update error: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn delete_ty_report_row(report_id: i64, row_id: i64, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|_| "DB lock error")?;
    let (table_name, _) = load_report_columns(&conn, report_id)?;
    let safe_table = sanitize_col_name(&table_name);

    conn.execute(
        &format!("DELETE FROM \"{safe_table}\" WHERE _row_id = ?1"),
        params![row_id],
    )
    .map_err(|e| format!("Delete row error: {e}"))?;

    let new_count: i64 = conn
        .query_row(&format!("SELECT COUNT(*) FROM \"{safe_table}\""), [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE ty_reports SET row_count = ?1 WHERE id = ?2",
        params![new_count, report_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn export_ty_report(report_id: i64, app: AppHandle, db: State<'_, DbState>) -> Result<String, String> {
    let (report_name, columns, rows) = {
        let conn = db.0.lock().map_err(|_| "DB lock error")?;

        let report: (String, String) = conn
            .query_row(
                "SELECT name, table_name FROM ty_reports WHERE id = ?1",
                params![report_id],
                |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)),
            )
            .map_err(|e| format!("Report not found: {e}"))?;

        let (report_name, table_name) = report;
        let safe_table = sanitize_col_name(&table_name);

        let mut stmt = conn
            .prepare(
                "SELECT id, name, display_name, col_type, display_order
                 FROM ty_report_columns WHERE report_id = ?1 ORDER BY display_order",
            )
            .map_err(|e| e.to_string())?;

        let columns: Vec<TyColumnMeta> = stmt
            .query_map(params![report_id], |row| {
                Ok(TyColumnMeta {
                    id: row.get(0)?,
                    report_id,
                    name: row.get(1)?,
                    display_name: row.get(2)?,
                    col_type: row.get(3)?,
                    display_order: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        let mut rows_stmt = conn
            .prepare(&format!("SELECT * FROM \"{safe_table}\""))
            .map_err(|e| e.to_string())?;
        let col_count = rows_stmt.column_count();
        let col_names: Vec<String> = rows_stmt.column_names().iter().map(|s| s.to_string()).collect();

        let rows = rows_stmt
            .query_map([], |row| {
                let mut map = serde_json::Map::new();
                for i in 0..col_count {
                    let val: Value = row.get(i)?;
                    map.insert(col_names[i].clone(), value_to_json(val));
                }
                Ok(serde_json::Value::Object(map))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        (report_name, columns, rows)
    };

    let default_filename = format!(
        "{}_{}.xlsx",
        report_name
            .chars()
            .map(|c| if c.is_alphanumeric() { c } else { '_' })
            .collect::<String>(),
        chrono::Local::now().format("%Y-%m-%d")
    );

    let path = app
        .dialog()
        .file()
        .add_filter("Excel Spreadsheet", &["xlsx"])
        .set_file_name(&default_filename)
        .blocking_save_file()
        .ok_or("Export cancelled")?;

    let path_str = path.to_string();

    tokio::task::spawn_blocking(move || -> Result<String, String> {
        use rust_xlsxwriter::{Format, FormatBorder, Workbook};

        let mut workbook = Workbook::new();
        let sheet = workbook.add_worksheet();

        let header_fmt = Format::new()
            .set_bold()
            .set_border(FormatBorder::Thin)
            .set_background_color(0x4472C4)
            .set_font_color(0xFFFFFF);
        let data_fmt = Format::new().set_border(FormatBorder::Thin);

        for (col_idx, col) in columns.iter().enumerate() {
            let header_name = col.display_name.as_deref().unwrap_or(&col.name);
            sheet
                .write_with_format(0, col_idx as u16, header_name, &header_fmt)
                .map_err(|e| format!("Header write error: {e}"))?;
        }

        for (row_idx, row) in rows.iter().enumerate() {
            for (col_idx, col) in columns.iter().enumerate() {
                let val = row.get(&col.name).unwrap_or(&serde_json::Value::Null);
                let r = row_idx as u32 + 1;
                let c = col_idx as u16;
                match val {
                    serde_json::Value::Number(n) => {
                        if let Some(i) = n.as_i64() {
                            if col.col_type.to_uppercase() == "INTEGER" {
                                sheet.write_with_format(r, c, i, &data_fmt).map_err(|e| format!("Write error: {e}"))?;
                                continue;
                            }
                        }
                        if let Some(f) = n.as_f64() {
                            sheet.write_with_format(r, c, f, &data_fmt).map_err(|e| format!("Write error: {e}"))?;
                        }
                    }
                    serde_json::Value::String(s) => {
                        sheet.write_with_format(r, c, s.as_str(), &data_fmt).map_err(|e| format!("Write error: {e}"))?;
                    }
                    serde_json::Value::Null => {}
                    other => {
                        sheet.write_with_format(r, c, other.to_string().as_str(), &data_fmt).map_err(|e| format!("Write error: {e}"))?;
                    }
                }
            }
        }

        sheet.autofit();
        workbook.save(&path_str).map_err(|e| format!("Save error: {e}"))?;
        Ok(path_str)
    })
    .await
    .map_err(|e| format!("Export task error: {e}"))?
}
