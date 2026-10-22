use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri::State;
use crate::db::DbState;
use crate::db::schema::sanitize_col_name;

#[derive(Debug, Serialize, Deserialize)]
pub struct TrendsConfig {
    pub date_column: String,
    pub value_column: String,
    pub period: String,
    pub aggregation: String,
}

#[derive(Debug, Serialize)]
pub struct TrendsResult {
    pub periods: Vec<String>,
    pub values: Vec<f64>,
    pub metrics: TrendMetrics,
}

#[derive(Debug, Serialize)]
pub struct TrendMetrics {
    pub total: f64,
    pub avg: f64,
    pub min: f64,
    pub max: f64,
    pub growth: f64,
}

#[tauri::command]
pub async fn run_trends_query(
    dataset_id: i64,
    config: TrendsConfig,
    app: AppHandle,
) -> Result<TrendsResult, String> {
    tauri::async_runtime::spawn_blocking(move || run_trends_query_sync(dataset_id, config, app.state::<DbState>()))
        .await
        .map_err(|e| e.to_string())?
}

fn run_trends_query_sync(
    dataset_id: i64,
    config: TrendsConfig,
    state: State<DbState>,
) -> Result<TrendsResult, String> {
    let conn = state.0.lock().unwrap();

    let table_name: String = conn
        .query_row("SELECT table_name FROM datasets WHERE id = ?", [dataset_id], |row| row.get(0))
        .map_err(|e| format!("Dataset not found: {}", e))?;

    let agg_sql = match config.aggregation.as_str() {
        "avg" => "AVG",
        "count" => "COUNT",
        _ => "SUM",
    };

    let safe_date_col = sanitize_col_name(&config.date_column);
    let safe_value_col = sanitize_col_name(&config.value_column);

    // Build SQL based on period
    // Dates are stored as YYYYMMDD integers (e.g., 20260212) or TEXT.
    // Convert to ISO date string: substr(Data, 1, 4) || '-' || substr(Data, 5, 2) || '-' || substr(Data, 7, 2)
    let date_expr = format!(
        "CASE WHEN typeof(\"{col}\") = 'integer' AND \"{col}\" >= 19000101 THEN \
         substr(CAST(\"{col}\" AS TEXT), 1, 4) || '-' || substr(CAST(\"{col}\" AS TEXT), 5, 2) || '-' || substr(CAST(\"{col}\" AS TEXT), 7, 2) \
         WHEN typeof(\"{col}\") = 'text' AND length(\"{col}\") = 8 THEN \
         substr(\"{col}\", 1, 4) || '-' || substr(\"{col}\", 5, 2) || '-' || substr(\"{col}\", 7, 2) \
         ELSE CAST(\"{col}\" AS TEXT) END",
        col = safe_date_col
    );

    let sql = match config.period.as_str() {
        "daily" => format!(
            "SELECT ({date_expr}) AS period, {agg_sql}(\"{val}\") AS value \
             FROM \"{tbl}\" WHERE \"{date}\" IS NOT NULL AND \"{val}\" IS NOT NULL \
             GROUP BY period ORDER BY period ASC",
            date_expr = date_expr, agg_sql = agg_sql, val = safe_value_col,
            tbl = table_name, date = safe_date_col
        ),
        "weekly" => format!(
            "SELECT strftime('%Y-W%W', {date_expr}) AS period, {agg_sql}(\"{val}\") AS value \
             FROM \"{tbl}\" WHERE \"{date}\" IS NOT NULL AND \"{val}\" IS NOT NULL \
             GROUP BY period ORDER BY period ASC",
            date_expr = date_expr, agg_sql = agg_sql, val = safe_value_col,
            tbl = table_name, date = safe_date_col
        ),
        "monthly" => format!(
            "SELECT strftime('%Y-%m', {date_expr}) AS period, {agg_sql}(\"{val}\") AS value \
             FROM \"{tbl}\" WHERE \"{date}\" IS NOT NULL AND \"{val}\" IS NOT NULL \
             GROUP BY period ORDER BY period ASC",
            date_expr = date_expr, agg_sql = agg_sql, val = safe_value_col,
            tbl = table_name, date = safe_date_col
        ),
        "quarterly" => format!(
            "SELECT strftime('%Y-Q', {date_expr}) || CAST((CAST(strftime('%m', {date_expr}) AS INTEGER) - 1) / 3 + 1 AS TEXT) AS period, \
             {agg_sql}(\"{val}\") AS value \
             FROM \"{tbl}\" WHERE \"{date}\" IS NOT NULL AND \"{val}\" IS NOT NULL \
             GROUP BY period ORDER BY period ASC",
            date_expr = date_expr, agg_sql = agg_sql, val = safe_value_col,
            tbl = table_name, date = safe_date_col
        ),
        "yearly" => format!(
            "SELECT strftime('%Y', {date_expr}) AS period, {agg_sql}(\"{val}\") AS value \
             FROM \"{tbl}\" WHERE \"{date}\" IS NOT NULL AND \"{val}\" IS NOT NULL \
             GROUP BY period ORDER BY period ASC",
            date_expr = date_expr, agg_sql = agg_sql, val = safe_value_col,
            tbl = table_name, date = safe_date_col
        ),
        _ => format!(
            "SELECT strftime('%Y-%m', {date_expr}) AS period, {agg_sql}(\"{val}\") AS value \
             FROM \"{tbl}\" WHERE \"{date}\" IS NOT NULL AND \"{val}\" IS NOT NULL \
             GROUP BY period ORDER BY period ASC",
            date_expr = date_expr, agg_sql = agg_sql, val = safe_value_col,
            tbl = table_name, date = safe_date_col
        ),
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| format!("SQL error: {}", e))?;

    let mut periods = Vec::new();
    let mut values = Vec::new();

    let mut rows = stmt.query([]).map_err(|e| format!("Query error: {}", e))?;
    while let Some(row) = rows.next().map_err(|e| format!("Row error: {}", e))? {
        let period: String = row.get(0).map_err(|e| format!("Period error: {}", e))?;
        let value: f64 = row.get(1).unwrap_or(0.0);
        periods.push(period);
        values.push(value);
    }

    let total: f64 = values.iter().sum();
    let count = values.len() as f64;
    let avg = if count > 0.0 { total / count } else { 0.0 };
    let min = values.iter().cloned().fold(f64::INFINITY, f64::min);
    let max = values.iter().cloned().fold(f64::NEG_INFINITY, f64::max);

    let growth = if values.len() >= 2 {
        let first = values[0];
        let last = values[values.len() - 1];
        if first != 0.0 {
            ((last - first) / first.abs()) * 100.0
        } else {
            0.0
        }
    } else {
        0.0
    };

    Ok(TrendsResult {
        periods,
        values,
        metrics: TrendMetrics {
            total,
            avg,
            min: if min.is_finite() { min } else { 0.0 },
            max: if max.is_finite() { max } else { 0.0 },
            growth,
        },
    })
}
