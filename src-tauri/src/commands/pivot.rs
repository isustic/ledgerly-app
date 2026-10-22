//! Pivot command for executing pivot table queries.
//!
//! This module generates SQL for pivot table operations:
//! - Rows: GROUP BY columns (row labels)
//! - Columns: Pivot column values become separate columns (dynamic)
//! - Values: Aggregated values (SUM, AVG, COUNT, MIN, MAX)
//! - Filters: WHERE clause filters
//!
//! Column names are validated against the database whitelist (columns metadata table)
//! before being used in SQL queries to prevent injection.

use crate::db::{DbState, schema::sanitize_col_name};
use tauri::{AppHandle, Manager};
use rusqlite::{params, Row};
use serde::{Deserialize, Serialize};
use std::time::Instant;
use tauri::State;

/// Allowed aggregation functions for pivot values.
const ALLOWED_FUNCS: &[&str] = &["SUM", "AVG", "COUNT", "MIN", "MAX"];

/// Allowed filter operators for SQL safety.
const ALLOWED_OPS: &[&str] = &["=", "!=", ">", "<", ">=", "<=", "LIKE"];

/// Returns all valid column names for a given dataset (used for whitelisting).
fn get_valid_columns(conn: &rusqlite::Connection, dataset_id: i64) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("SELECT name FROM columns WHERE dataset_id = ?1")
        .map_err(|e| e.to_string())?;
    let names = stmt
        .query_map(params![dataset_id], |r| r.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(names)
}

/// Validates that a column name exists in the allowed set.
fn validate_col(name: &str, allowed: &[String]) -> Result<String, String> {
    let safe = sanitize_col_name(name);
    if allowed.contains(&safe) {
        Ok(safe)
    } else {
        Err(format!("Column '{}' is not valid for this dataset", name))
    }
}

/// Validates an aggregation function.
fn validate_agg_func(func: &str) -> Result<&str, String> {
    ALLOWED_FUNCS
        .iter()
        .find(|&&f| f.eq_ignore_ascii_case(func))
        .copied()
        .ok_or_else(|| format!("Unsupported aggregation function: {}", func))
}

/// Validates a filter operator.
fn validate_operator(op: &str) -> Result<&str, String> {
    ALLOWED_OPS
        .iter()
        .find(|&&o| o == op)
        .copied()
        .ok_or_else(|| format!("Unsupported operator: {}", op))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PivotValue {
    pub column: String,
    pub agg: String, // "SUM", "AVG", "COUNT", "MIN", "MAX"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PivotConfig {
    pub rows: Vec<String>,
    pub columns: Vec<String>,
    pub values: Vec<PivotValue>,
    pub filters: Vec<PivotFilter>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PivotFilter {
    pub column: String,
    pub operator: String,
    pub value: String,
}

#[derive(Debug, Serialize)]
pub struct PivotResult {
    pub columns: Vec<String>,
    pub rows: Vec<PivotRow>,
}

#[derive(Debug, Serialize)]
pub struct PivotRow {
    pub cells: Vec<String>,
}

/// Executes a pivot query and returns the result.
///
/// For simple pivots without dynamic column pivoting, this generates
/// a straightforward GROUP BY query with aggregations.
///
/// For true pivot tables (column values becoming headers), a more complex
/// query structure is needed - this is handled in build_pivot_query.
#[tauri::command]
pub async fn run_pivot_query(
    dataset_id: i64,
    config: PivotConfig,
    app: AppHandle,
) -> Result<PivotResult, String> {
    tauri::async_runtime::spawn_blocking(move || run_pivot_query_sync(dataset_id, config, app.state::<DbState>()))
        .await
        .map_err(|e| e.to_string())?
}

fn run_pivot_query_sync(
    dataset_id: i64,
    config: PivotConfig,
    db: State<'_, DbState>,
) -> Result<PivotResult, String> {
    let start_time = Instant::now();
    let conn = db.0.lock().map_err(|e| format!("DB lock error: {}", e))?;

    // Get the table name for this dataset
    let table_name: String = conn
        .query_row(
            "SELECT table_name FROM datasets WHERE id = ?1",
            params![dataset_id],
            |r| r.get(0),
        )
        .map_err(|e| format!("Dataset not found: {}", e))?;

    // Get whitelist of valid columns for this dataset
    let valid_cols = get_valid_columns(&conn, dataset_id)?;

    // Validate all column names in config
    for row_col in &config.rows {
        validate_col(row_col, &valid_cols)?;
    }
    for col_col in &config.columns {
        validate_col(col_col, &valid_cols)?;
    }
    for value in &config.values {
        validate_col(&value.column, &valid_cols)?;
        validate_agg_func(&value.agg)?;
    }
    for filter in &config.filters {
        validate_col(&filter.column, &valid_cols)?;
        validate_operator(&filter.operator)?;
    }

    // Build and execute the query
    let (sql, bind_values, result_columns) = build_pivot_query(&table_name, &config, &valid_cols)?;

    // Execute query
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Query preparation failed: {}", e))?;

    let pivot_rows = stmt
        .query_map(rusqlite::params_from_iter(bind_values.iter()), |row| {
            parse_pivot_row(row, config.rows.len() + config.values.len())
        })
        .map_err(|e| format!("Query execution failed: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Row parsing failed: {}", e))?;

    // Track analytics
    let row_count = pivot_rows.len() as i64;
    let duration_ms = start_time.elapsed().as_millis() as i64;

    let config_json = serde_json::to_string(&config).unwrap_or_default();
    let _ = conn.execute(
        "INSERT INTO query_history (report_config, row_count, duration_ms) VALUES (?1, ?2, ?3)",
        params![config_json, row_count, duration_ms],
    );

    Ok(PivotResult {
        columns: result_columns,
        rows: pivot_rows,
    })
}

/// Builds the SQL query for pivot operations.
///
/// For true pivot tables with dynamic columns, this uses a simplified approach:
/// - GROUP BY the row columns
/// - Apply aggregations to value columns
/// - Column pivoting (values becoming headers) is handled on the frontend
fn build_pivot_query(
    table_name: &str,
    config: &PivotConfig,
    valid_cols: &[String],
) -> Result<(String, Vec<String>, Vec<String>), String> {
    if config.rows.is_empty() {
        return Err("At least one row column must be specified".to_string());
    }

    if config.values.is_empty() {
        return Err("At least one value column must be specified".to_string());
    }

    let mut select_parts = vec![];
    let mut group_by_parts = vec![];
    let mut result_columns = vec![];
    let mut bind_values = vec![];

    // Add row columns (these become the row labels)
    for row_col in &config.rows {
        let safe_name = validate_col(row_col, valid_cols)?;
        select_parts.push(format!("\"{}\"", safe_name));
        group_by_parts.push(format!("\"{}\"", safe_name));
        result_columns.push(safe_name);
    }

    // Add values with aggregation
    for value in &config.values {
        let safe_col = validate_col(&value.column, valid_cols)?;
        let func = validate_agg_func(&value.agg)?;

        // Create a column alias like "SUM_ColumnName"
        let alias = format!("{}_{}", func, safe_col);
        let agg_expr = match func {
            "SUM" => format!("COALESCE(SUM(\"{}\"), 0) AS \"{}\"", safe_col, alias),
            "AVG" => format!("COALESCE(AVG(\"{}\"), 0) AS \"{}\"", safe_col, alias),
            "COUNT" => format!("COUNT(\"{}\") AS \"{}\"", safe_col, alias),
            "MIN" => format!("COALESCE(MIN(\"{}\"), 0) AS \"{}\"", safe_col, alias),
            "MAX" => format!("COALESCE(MAX(\"{}\"), 0) AS \"{}\"", safe_col, alias),
            _ => format!("COALESCE(SUM(\"{}\"), 0) AS \"{}\"", safe_col, alias),
        };
        select_parts.push(agg_expr);
        result_columns.push(alias);
    }

    let mut query = format!("SELECT {} FROM \"{}\"", select_parts.join(", "), table_name);

    // Add filters (WHERE clause)
    if !config.filters.is_empty() {
        let filter_parts: Vec<String> = config
            .filters
            .iter()
            .map(|f| -> Result<String, String> {
                let safe_col = validate_col(&f.column, valid_cols)?;
                let op = validate_operator(&f.operator)?;
                let placeholder = format!("?{}", bind_values.len() + 1);
                bind_values.push(f.value.clone());
                Ok(format!("\"{}\" {} {}", safe_col, op, placeholder))
            })
            .collect::<Result<Vec<_>, _>>()?;
        query.push_str(&format!(" WHERE {}", filter_parts.join(" AND ")));
    }

    // Add GROUP BY
    if !group_by_parts.is_empty() {
        query.push_str(&format!(" GROUP BY {}", group_by_parts.join(", ")));
    }

    Ok((query, bind_values, result_columns))
}

/// Parses a row from the pivot query result.
fn parse_pivot_row(row: &Row, col_count: usize) -> Result<PivotRow, rusqlite::Error> {
    let mut cells = Vec::with_capacity(col_count);

    for i in 0..col_count {
        let value: rusqlite::types::Value = row.get(i)?;

        let cell_value = match value {
            rusqlite::types::Value::Null => String::new(),
            rusqlite::types::Value::Integer(n) => n.to_string(),
            rusqlite::types::Value::Real(f) => {
                // Format floats to avoid unnecessary decimal places
                if f.fract() == 0.0 {
                    format!("{}", f as i64)
                } else {
                    format!("{}", f)
                }
            }
            rusqlite::types::Value::Text(s) => s,
            rusqlite::types::Value::Blob(_) => "[blob]".to_string(),
        };

        cells.push(cell_value);
    }

    Ok(PivotRow { cells })
}
