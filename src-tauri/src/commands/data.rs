use crate::db::{DbState, schema::sanitize_col_name};
use tauri::{AppHandle, Manager};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

/// Clear all user data: drop dataset tables, wipe metadata tables.
/// Preserves the subgroups reference table.
#[tauri::command]
pub fn clear_database(db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| format!("DB lock error: {e}"))?;

    // Collect all dataset table names before wiping metadata
    let mut stmt = conn
        .prepare("SELECT table_name FROM datasets")
        .map_err(|e| format!("Query error: {e}"))?;
    let tables: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("Read error: {e}"))?
        .filter_map(|t| t.ok())
        .collect();

    // Collect all TY report table names before wiping metadata
    let mut stmt = conn
        .prepare("SELECT table_name FROM ty_reports")
        .map_err(|e| format!("Query error: {e}"))?;
    let ty_tables: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("Read error: {e}"))?
        .filter_map(|t| t.ok())
        .collect();

    // Drop each dataset table
    for table in &tables {
        let safe = sanitize_col_name(table);
        conn.execute_batch(&format!("DROP TABLE IF EXISTS \"{safe}\";"))
            .map_err(|e| format!("Drop table error: {e}"))?;
    }

    // Drop each TY report table
    for table in &ty_tables {
        let safe = sanitize_col_name(table);
        conn.execute_batch(&format!("DROP TABLE IF EXISTS \"{safe}\";"))
            .map_err(|e| format!("Drop table error: {e}"))?;
    }

    // Wipe metadata tables
    conn.execute_batch(
        "DELETE FROM columns;
         DELETE FROM datasets;
         DELETE FROM ty_report_columns;
         DELETE FROM ty_reports;
         DELETE FROM report_templates;
         DELETE FROM analytics_events;
         DELETE FROM query_history;
         DELETE FROM favorites;
         DELETE FROM calculated_fields;
         DELETE FROM blend_configs;",
    )
    .map_err(|e| format!("Clear metadata error: {e}"))?;

    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Dataset {
    pub id: i64,
    pub name: String,
    pub file_origin: String,
    pub table_name: String,
    pub row_count: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ColumnMeta {
    pub id: i64,
    pub name: String,
    pub col_type: String,
    pub display_order: i64,
}

#[tauri::command]
pub fn list_datasets(db: State<'_, DbState>) -> Result<Vec<Dataset>, String> {
    let conn = db.0.lock().map_err(|_| "DB lock error")?;
    let mut stmt = conn
        .prepare("SELECT id, name, file_origin, table_name, row_count, created_at FROM datasets ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let datasets = stmt.query_map([], |row| {
        Ok(Dataset {
            id: row.get(0)?,
            name: row.get(1)?,
            file_origin: row.get(2)?,
            table_name: row.get(3)?,
            row_count: row.get(4)?,
            created_at: row.get(5)?,
        })
    })
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(datasets)
}

#[tauri::command]
pub fn get_columns(dataset_id: i64, db: State<'_, DbState>) -> Result<Vec<ColumnMeta>, String> {
    let conn = db.0.lock().map_err(|_| "DB lock error")?;
    let mut stmt = conn
        .prepare("SELECT id, name, col_type, display_order FROM columns WHERE dataset_id = ?1 ORDER BY display_order")
        .map_err(|e| e.to_string())?;

    let cols = stmt
        .query_map(params![dataset_id], |row| {
            Ok(ColumnMeta {
                id: row.get(0)?,
                name: row.get(1)?,
                col_type: row.get(2)?,
                display_order: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(cols)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PagedRows {
    pub rows: Vec<serde_json::Value>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

#[tauri::command]
pub async fn get_rows(
    dataset_id: i64,
    page: i64,
    page_size: i64,
    app: AppHandle,
) -> Result<PagedRows, String> {
    tauri::async_runtime::spawn_blocking(move || get_rows_sync(dataset_id, page, page_size, app.state::<DbState>()))
        .await
        .map_err(|e| e.to_string())?
}

fn get_rows_sync(
    dataset_id: i64,
    page: i64,
    page_size: i64,
    db: State<'_, DbState>,
) -> Result<PagedRows, String> {
    let conn = db.0.lock().map_err(|_| "DB lock error")?;

    // Get the table name for this dataset
    let table_name: String = conn
        .query_row(
            "SELECT table_name FROM datasets WHERE id = ?1",
            params![dataset_id],
            |r| r.get(0),
        )
        .map_err(|e| format!("Dataset not found: {e}"))?;

    let safe_table = sanitize_col_name(&table_name);
    let total: i64 = conn
        .query_row(&format!("SELECT COUNT(*) FROM \"{safe_table}\""), [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let offset = page * page_size;
    let sql = format!("SELECT * FROM \"{safe_table}\" LIMIT ?1 OFFSET ?2");
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let col_count = stmt.column_count();
    let col_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

    let rows = stmt
        .query_map(params![page_size, offset], |row| {
            let mut map = serde_json::Map::new();
            for i in 0..col_count {
                let val: rusqlite::types::Value = row.get(i)?;
                let json_val = match val {
                    rusqlite::types::Value::Null => serde_json::Value::Null,
                    rusqlite::types::Value::Integer(n) => serde_json::Value::Number(n.into()),
                    rusqlite::types::Value::Real(f) => {
                        serde_json::Value::Number(serde_json::Number::from_f64(f).unwrap_or(0.into()))
                    }
                    rusqlite::types::Value::Text(s) => serde_json::Value::String(s),
                    rusqlite::types::Value::Blob(_) => serde_json::Value::String("[blob]".into()),
                };
                map.insert(col_names[i].clone(), json_val);
            }
            Ok(serde_json::Value::Object(map))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(PagedRows { rows, total, page, page_size })
}

#[tauri::command]
pub fn delete_dataset(dataset_id: i64, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|_| "DB lock error")?;
    let table_name: String = conn
        .query_row("SELECT table_name FROM datasets WHERE id = ?1", params![dataset_id], |r| r.get(0))
        .map_err(|e| format!("Dataset not found: {e}"))?;

    let safe_table = sanitize_col_name(&table_name);
    conn.execute_batch(&format!("DROP TABLE IF EXISTS \"{safe_table}\";"))
        .map_err(|e| format!("Drop table error: {e}"))?;
    conn.execute("DELETE FROM datasets WHERE id = ?1", params![dataset_id])
        .map_err(|e| format!("Delete error: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn rename_dataset(dataset_id: i64, new_name: String, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|_| "DB lock error")?;
    conn.execute(
        "UPDATE datasets SET name = ?1 WHERE id = ?2",
        params![new_name, dataset_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Escapes special LIKE characters (%) and (_) with backslash
fn escape_like(query: &str) -> String {
    query.replace('\\', "\\\\")
         .replace('%', "\\%")
         .replace('_', "\\_")
}

#[tauri::command]
pub async fn search_rows(
    dataset_id: i64,
    query: String,
    page: i64,
    page_size: i64,
    app: AppHandle,
) -> Result<PagedRows, String> {
    tauri::async_runtime::spawn_blocking(move || search_rows_sync(dataset_id, query, page, page_size, app.state::<DbState>()))
        .await
        .map_err(|e| e.to_string())?
}

fn search_rows_sync(
    dataset_id: i64,
    query: String,
    page: i64,
    page_size: i64,
    db: State<'_, DbState>,
) -> Result<PagedRows, String> {
    let conn = db.0.lock().map_err(|_| "DB lock error")?;

    // Get the table name for this dataset
    let table_name: String = conn
        .query_row(
            "SELECT table_name FROM datasets WHERE id = ?1",
            params![dataset_id],
            |r| r.get(0),
        )
        .map_err(|e| format!("Dataset not found: {e}"))?;

    // Get column definitions for this dataset
    let mut cols_stmt = conn
        .prepare("SELECT name, col_type FROM columns WHERE dataset_id = ?1 ORDER BY display_order")
        .map_err(|e| e.to_string())?;

    let columns = cols_stmt
        .query_map(params![dataset_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<(String, String)>, _>>()
        .map_err(|e| e.to_string())?;

    let safe_table = sanitize_col_name(&table_name);

    // Filter to only TEXT columns for searching
    let text_columns: Vec<String> = columns
        .into_iter()
        .filter(|(_, col_type)| col_type == "TEXT")
        .map(|(name, _)| sanitize_col_name(&name))
        .collect();

    // If no text columns or empty query, return all rows (like get_rows)
    let offset = page * page_size;

    let (total, rows) = if text_columns.is_empty() || query.trim().is_empty() {
        // No filtering needed - get all rows
        let total: i64 = conn
            .query_row(&format!("SELECT COUNT(*) FROM \"{safe_table}\""), [], |r| r.get(0))
            .map_err(|e| e.to_string())?;

        let sql = format!("SELECT * FROM \"{safe_table}\" LIMIT ?1 OFFSET ?2");
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

        let col_count = stmt.column_count();
        let col_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

        let rows = stmt
            .query_map(params![page_size, offset], |row| {
                let mut map = serde_json::Map::new();
                for i in 0..col_count {
                    let val: rusqlite::types::Value = row.get(i)?;
                    let json_val = match val {
                        rusqlite::types::Value::Null => serde_json::Value::Null,
                        rusqlite::types::Value::Integer(n) => serde_json::Value::Number(n.into()),
                        rusqlite::types::Value::Real(f) => {
                            serde_json::Value::Number(serde_json::Number::from_f64(f).unwrap_or(0.into()))
                        }
                        rusqlite::types::Value::Text(s) => serde_json::Value::String(s),
                        rusqlite::types::Value::Blob(_) => serde_json::Value::String("[blob]".into()),
                    };
                    map.insert(col_names[i].clone(), json_val);
                }
                Ok(serde_json::Value::Object(map))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        (total, rows)
    } else {
        // Build WHERE clause with LIKE for each text column
        let escaped_query = escape_like(&query);
        let search_pattern = format!("%{}%", escaped_query);

        let where_clauses: Vec<String> = text_columns
            .iter()
            .map(|col| format!(r#""{col}" LIKE ?1 ESCAPE '\'"#))
            .collect();

        let where_clause = where_clauses.join(" OR ");

        // Get total count matching the search
        let count_sql = format!("SELECT COUNT(*) FROM \"{safe_table}\" WHERE {}", where_clause);
        let total: i64 = conn
            .query_row(&count_sql, params![&search_pattern], |r| r.get(0))
            .map_err(|e| e.to_string())?;

        // Get paginated rows
        let data_sql = format!("SELECT * FROM \"{safe_table}\" WHERE {} LIMIT ?2 OFFSET ?3", where_clause);
        let mut stmt = conn.prepare(&data_sql).map_err(|e| e.to_string())?;

        let col_count = stmt.column_count();
        let col_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

        let rows = stmt
            .query_map(params![&search_pattern, page_size, offset], |row| {
                let mut map = serde_json::Map::new();
                for i in 0..col_count {
                    let val: rusqlite::types::Value = row.get(i)?;
                    let json_val = match val {
                        rusqlite::types::Value::Null => serde_json::Value::Null,
                        rusqlite::types::Value::Integer(n) => serde_json::Value::Number(n.into()),
                        rusqlite::types::Value::Real(f) => {
                            serde_json::Value::Number(serde_json::Number::from_f64(f).unwrap_or(0.into()))
                        }
                        rusqlite::types::Value::Text(s) => serde_json::Value::String(s),
                        rusqlite::types::Value::Blob(_) => serde_json::Value::String("[blob]".into()),
                    };
                    map.insert(col_names[i].clone(), json_val);
                }
                Ok(serde_json::Value::Object(map))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        (total, rows)
    };

    Ok(PagedRows { rows, total, page, page_size })
}
