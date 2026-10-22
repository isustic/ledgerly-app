use serde::Serialize;
use tauri::{AppHandle, Manager};
use tauri::State;
use rusqlite::params;
use crate::db::DbState;

#[derive(Debug, Serialize)]
pub struct CalculatedField {
    pub id: i64,
    pub name: String,
    pub formula_sql: String,
}

#[tauri::command]
pub fn save_formula(
    dataset_id: i64,
    name: String,
    formula_sql: String,
    state: State<DbState>,
) -> Result<CalculatedField, String> {
    let conn = state.0.lock().map_err(|_| "DB lock error")?;

    conn.execute(
        "INSERT INTO calculated_fields (dataset_id, name, formula_sql) VALUES (?1, ?2, ?3)",
        params![dataset_id, name, formula_sql],
    )
    .map_err(|e| format!("Failed to save formula: {}", e))?;

    let id = conn.last_insert_rowid();

    Ok(CalculatedField {
        id,
        name,
        formula_sql,
    })
}

#[tauri::command]
pub fn list_formulas(
    dataset_id: i64,
    state: State<DbState>,
) -> Result<Vec<CalculatedField>, String> {
    let conn = state.0.lock().map_err(|_| "DB lock error")?;

    let mut stmt = conn
        .prepare("SELECT id, name, formula_sql FROM calculated_fields WHERE dataset_id = ?1")
        .map_err(|e| format!("Query failed: {}", e))?;

    let formulas = stmt
        .query_map(params![dataset_id], |row| {
            Ok(CalculatedField {
                id: row.get(0)?,
                name: row.get(1)?,
                formula_sql: row.get(2)?,
            })
        })
        .map_err(|e| format!("Failed to parse formulas: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect formulas: {}", e))?;

    Ok(formulas)
}

#[tauri::command]
pub fn delete_formula(
    formula_id: i64,
    state: State<DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|_| "DB lock error")?;

    conn.execute("DELETE FROM calculated_fields WHERE id = ?1", params![formula_id])
        .map_err(|e| format!("Failed to delete formula: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn test_formula(
    dataset_id: i64,
    formula_sql: String,
    app: AppHandle,
) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || test_formula_sync(dataset_id, formula_sql, app.state::<DbState>()))
        .await
        .map_err(|e| e.to_string())?
}

fn test_formula_sync(
    dataset_id: i64,
    formula_sql: String,
    state: State<DbState>,
) -> Result<serde_json::Value, String> {
    let conn = state.0.lock().map_err(|_| "DB lock error")?;

    // Get dataset table name
    let table_name: String = conn
        .query_row(
            "SELECT table_name FROM datasets WHERE id = ?1",
            params![dataset_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Dataset not found: {}", e))?;

    // Check if formula uses aggregate functions (returns single value)
    let aggregate_keywords = ["SUM(", "AVG(", "COUNT(", "MIN(", "MAX(", "COUNT"];
    let is_aggregate = aggregate_keywords.iter().any(|kw| formula_sql.to_uppercase().contains(kw));

    if is_aggregate {
        // For aggregates, return just the single scalar value
        let sql = format!("SELECT ({}) AS result FROM {}", formula_sql, table_name);
        let result: Option<f64> = conn
            .query_row(&sql, [], |row| row.get(0))
            .map_err(|e| format!("Query execution failed: {}", e))?;

        Ok(serde_json::json!({
            "type": "scalar",
            "value": result,
            "formula": formula_sql,
        }))
    } else {
        // For row-level calculations, return first 10 rows with just the formula result
        let sql = format!(
            "SELECT ({}) AS result FROM {} LIMIT 10",
            formula_sql, table_name
        );

        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| format!("Query preparation failed: {}", e))?;

        let results = stmt
            .query_map([], |row| {
                let value: Option<String> = row.get(0).ok();
                Ok(serde_json::json!(value.unwrap_or_else(|| "NULL".to_string())))
            })
            .map_err(|e| format!("Query execution failed: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Result collection failed: {}", e))?;

        Ok(serde_json::json!({
            "type": "rows",
            "values": results,
            "formula": formula_sql,
        }))
    }
}
