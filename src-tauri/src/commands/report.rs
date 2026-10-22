//! Report command for executing SimpleQuery requests.
//!
//! This module generates SQL based on the SimpleQuery schema:
//! - Non-grouped queries: SELECT display_columns FROM table WHERE ... ORDER BY ...
//! - Grouped queries: SELECT group_by + calculations FROM table WHERE ... GROUP BY ...
//!
//! All column names are validated against the database whitelist (columns metadata table)
//! before being used in SQL queries to prevent injection.

use crate::commands::queries::{SimpleQuery, FilterValue};
use tauri::{AppHandle, Manager};
use crate::db::{DbState, schema::sanitize_col_name};
use rusqlite::params;
use std::time::Instant;
use std::collections::HashMap;
use tauri::State;

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

/// Returns a map of column names to their types for a given dataset.
/// Used to properly type filter values when binding to SQL.
fn get_column_types(conn: &rusqlite::Connection, dataset_id: i64) -> Result<HashMap<String, String>, String> {
    let mut stmt = conn
        .prepare("SELECT name, col_type FROM columns WHERE dataset_id = ?1")
        .map_err(|e| e.to_string())?;
    let mut map = HashMap::new();
    let rows = stmt
        .query_map(params![dataset_id], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?;
    for row in rows {
        let (name, col_type) = row.map_err(|e| e.to_string())?;
        map.insert(name, col_type);
    }
    Ok(map)
}

/// Validates that a column name exists in the allowed set.
fn validate_col(name: &str, allowed: &[String]) -> Result<String, String> {
    let safe = sanitize_col_name(name);
    if allowed.contains(&safe) {
        Ok(safe)
    } else {
        Err(format!("Column '{name}' is not valid for this dataset"))
    }
}

/// Validates an alias name (only allows alphanumeric and underscore).
fn validate_alias(name: &str) -> Result<String, String> {
    let safe = sanitize_col_name(name);
    if safe.is_empty() {
        Err(format!("Invalid alias: '{name}'"))
    } else {
        Ok(safe)
    }
}

/// Allowed filter operators for SQL safety.
const ALLOWED_OPS: &[&str] = &["=", "!=", ">", "<", ">=", "<=", "LIKE"];

/// Allowed aggregation functions.
const ALLOWED_FUNCS: &[&str] = &["SUM", "COUNT", "AVG", "MIN", "MAX"];

/// Executes a SimpleQuery and returns the result as JSON rows.
#[tauri::command]
pub async fn run_report(
    query: SimpleQuery,
    app: AppHandle,
) -> Result<Vec<serde_json::Value>, String> {
    tauri::async_runtime::spawn_blocking(move || run_report_sync(query, app.state::<DbState>()))
        .await
        .map_err(|e| e.to_string())?
}

fn run_report_sync(
    query: SimpleQuery,
    db: State<'_, DbState>,
) -> Result<Vec<serde_json::Value>, String> {
    let start_time = Instant::now();

    // DEBUG: Log the incoming query
    eprintln!("🔍 DEBUG run_report - filters count: {}", query.filters.len());
    for (i, f) in query.filters.iter().enumerate() {
        eprintln!("  Filter {}: column='{}', operator='{}', value='{}'", i, f.column, f.operator, f.value);
    }

    let conn = db.0.lock().map_err(|e| format!("DB lock error: {e}"))?;

    // Get the table name for this dataset
    let table_name: String = conn
        .query_row(
            "SELECT table_name FROM datasets WHERE id = ?1",
            params![query.dataset_id],
            |r| r.get(0),
        )
        .map_err(|e| format!("Dataset not found: {e}"))?;

    // Get whitelist of valid columns for this dataset
    let valid_cols = get_valid_columns(&conn, query.dataset_id)?;
    // Get column types for proper filter value binding
    let column_types = get_column_types(&conn, query.dataset_id)?;
    let safe_table = sanitize_col_name(&table_name);

    // Determine if this is a grouped query
    let is_grouped = !query.group_by.is_empty();

    let mut sql: String;
    let mut bind_values: Vec<FilterValue> = Vec::new();

    if is_grouped {
        // Grouped query: SELECT group_by + calculations, GROUP BY group_by
        let mut select_parts: Vec<String> = Vec::new();
        let mut group_parts: Vec<String> = Vec::new();

        // Add group_by columns to SELECT and GROUP BY
        for col in &query.group_by {
            let safe = validate_col(col, &valid_cols)?;
            select_parts.push(format!("\"{safe}\""));
            group_parts.push(format!("\"{safe}\""));
        }

        // Add calculations
        for calc in &query.calculations {
            let safe_col = validate_col(&calc.column, &valid_cols)?;
            let safe_alias = validate_alias(&calc.alias)?;
            let func = calc.to_sql_function();
            if !ALLOWED_FUNCS.contains(&func.as_str()) {
                return Err(format!("Unsupported aggregation function: {}", calc.function));
            }
            select_parts.push(format!("{func}(\"{safe_col}\") AS \"{safe_alias}\""));
        }

        // If no calculations but we have grouping, add COUNT(*) for valid SQL
        if query.calculations.is_empty() {
            select_parts.push("COUNT(*) AS \"count\"".to_string());
        }

        sql = format!(
            "SELECT {} FROM \"{}\"",
            select_parts.join(", "),
            safe_table
        );

        // WHERE clause
        let mut where_parts: Vec<String> = Vec::new();
        for filter in &query.filters {
            let safe_col = validate_col(&filter.column, &valid_cols)?;
            let op = filter.to_sql_operator();
            if !ALLOWED_OPS.contains(&op) {
                return Err(format!("Unsupported operator: {}", filter.operator));
            }
            let placeholder = format!("?{}", bind_values.len() + 1);
            where_parts.push(format!("\"{safe_col}\" {} {placeholder}", op));
            // Get column type for proper value conversion
            let col_type = column_types.get(&safe_col).map(|s| s.as_str()).unwrap_or("TEXT");
            bind_values.push(filter.to_filter_value(col_type));
        }

        if !where_parts.is_empty() {
            sql.push_str(&format!(" WHERE {}", where_parts.join(" AND ")));
        }

        // GROUP BY clause
        sql.push_str(&format!(" GROUP BY {}", group_parts.join(", ")));

        // ORDER BY clause (can reference group_by columns or calculation aliases)
        // Build alias list from calculations
        let calc_aliases: Vec<String> = query.calculations
            .iter()
            .map(|c| sanitize_col_name(&c.alias))
            .collect();

        if !query.sort_by.is_empty() {
            let mut order_parts: Vec<String> = Vec::new();
            for sort in &query.sort_by {
                let safe_name = sanitize_col_name(&sort.column);
                let dir = if sort.descending { " DESC" } else { "" };

                // Check if it's a valid column or a calculation alias
                if valid_cols.contains(&safe_name) || calc_aliases.contains(&safe_name) {
                    order_parts.push(format!("\"{safe_name}\"{dir}"));
                } else {
                    return Err(format!("Invalid sort column '{}': not a valid column or calculation alias", sort.column));
                }
            }
            sql.push_str(&format!(" ORDER BY {}", order_parts.join(", ")));
        }

    } else {
        // Non-grouped query: SELECT display_columns FROM table WHERE ...

        if query.display_columns.is_empty() {
            return Err("No display columns specified".into());
        }

        let validated_cols: Result<Vec<String>, String> = query
            .display_columns
            .iter()
            .map(|col| validate_col(col, &valid_cols))
            .collect();
        let validated_cols = validated_cols?;

        let select_clause = validated_cols
            .iter()
            .map(|c| format!("\"{c}\""))
            .collect::<Vec<_>>()
            .join(", ");

        sql = format!("SELECT {} FROM \"{}\"", select_clause, safe_table);

        // WHERE clause
        let mut where_parts: Vec<String> = Vec::new();
        for filter in &query.filters {
            let safe_col = validate_col(&filter.column, &valid_cols)?;
            let op = filter.to_sql_operator();
            if !ALLOWED_OPS.contains(&op) {
                return Err(format!("Unsupported operator: {}", filter.operator));
            }
            let placeholder = format!("?{}", bind_values.len() + 1);
            where_parts.push(format!("\"{safe_col}\" {} {placeholder}", op));
            // Get column type for proper value conversion
            let col_type = column_types.get(&safe_col).map(|s| s.as_str()).unwrap_or("TEXT");
            bind_values.push(filter.to_filter_value(col_type));
        }

        if !where_parts.is_empty() {
            sql.push_str(&format!(" WHERE {}", where_parts.join(" AND ")));
        }

        // ORDER BY clause
        for sort in &query.sort_by {
            let safe_col = validate_col(&sort.column, &valid_cols)?;
            let dir = if sort.descending { " DESC" } else { "" };
            sql.push_str(&format!(" ORDER BY \"{}\"{}", safe_col, dir));
        }
    }

    // LIMIT clause (applies to both query types)
    if let Some(limit) = query.limit {
        if limit > 0 {
            sql.push_str(&format!(" LIMIT {}", limit));
        }
    }

    // DEBUG: Log the SQL and bind values
    eprintln!("🔍 DEBUG SQL: {}", sql);
    eprintln!("🔍 DEBUG bind values: {:?}", bind_values);

    // Execute query with parameterized values
    let mut stmt = conn.prepare(&sql).map_err(|e| format!("SQL error: {e}"))?;
    let col_count = stmt.column_count();
    let col_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

    let result_rows = stmt
        .query_map(rusqlite::params_from_iter(bind_values.iter()), |row| {
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
        .map_err(|e| format!("Query error: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Row error: {e}"))?;

    let row_count = result_rows.len() as i64;
    let duration_ms = start_time.elapsed().as_millis() as i64;

    // Save query to history for analytics
    let query_json = serde_json::to_string(&query).unwrap_or_default();
    let _ = conn.execute(
        "INSERT INTO query_history (report_config, row_count, duration_ms) VALUES (?1, ?2, ?3)",
        params![query_json, row_count, duration_ms],
    );

    // Also track the event
    let _ = conn.execute(
        "INSERT INTO analytics_events (event_type, metadata) VALUES ('report_run', ?1)",
        params![format!("{{\"rows\": {}, \"duration_ms\": {}}}", row_count, duration_ms)],
    );

    Ok(result_rows)
}
