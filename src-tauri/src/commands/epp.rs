//! EPro (Agent Performance) report commands.
//!
//! Generates quarterly reports grouped by client for a specific agent.

use crate::db::DbState;
use chrono::{Datelike, NaiveDate, Duration};
use rusqlite::params;
use rust_xlsxwriter::{Format, FormatBorder, Workbook};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

/// Unique agent information with client count
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInfo {
    pub name: String,
    pub client_count: i64,
}

/// Single row in the EPro report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EppRow {
    pub client: String,
    pub agent: String,
    pub q1_total: f64,
    pub q2_total: f64,
    pub q3_total: f64,
    pub q4_total: f64,
    pub total_anual: f64,
    pub reducere: f64,     // 7.5% reduction
    pub total: f64,         // same as reducere
    pub program: String,    // program name or "-"
    pub procent: String,    // percentage or "-"
    pub total_2025: f64,          // Total 2025 from TY reports
    pub vs_2025_2026: f64,        // total_anual - total_2025
    pub bonus_crestere: f64,      // 2% if vs_2025_2026 > 0, else 0%
    pub culoare_decolorare_q1: f64,
    pub culoare_decolorare_q2: f64,
    pub culoare_decolorare_q3: f64,
    pub culoare_decolorare_q4: f64,
    pub haircare_tehnic_q1: f64,
    pub haircare_tehnic_q2: f64,
    pub haircare_tehnic_q3: f64,
    pub haircare_tehnic_q4: f64,
    pub suma_bonus: f64,
    pub suma_bonus_reducere: f64,  // Suma calcul bonus - 7.5%
    pub total_bonus: f64,          // procent + bonus_crestere
    pub suma_voucher: f64,         // (total_bonus / 100) * suma_bonus_reducere
    pub is_combined: bool,
    pub source_clients: Vec<String>,
}

/// Complete EPro report result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EppReportResult {
    pub agent_name: String,
    pub year: i32,
    pub rows: Vec<EppRow>,
}

/// Get all unique agents from all dataset tables
#[tauri::command]
pub fn get_unique_agents(db: State<'_, DbState>) -> Result<Vec<AgentInfo>, String> {
    let conn = db.0.lock().map_err(|e| format!("DB lock error: {e}"))?;

    // Get all datasets with their info
    let mut stmt = conn
        .prepare("SELECT id, table_name FROM datasets ORDER BY name")
        .map_err(|e| format!("Failed to query datasets: {e}"))?;

    let datasets: Vec<(i64, String)> = stmt
        .query_map([], |row| {
            let id: i64 = row.get(0)?;
            let table_name: String = row.get(1)?;
            Ok((id, table_name))
        })
        .map_err(|e| format!("Failed to read dataset names: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to parse dataset names: {e}"))?;

    let mut agents: std::collections::HashMap<String, i64> = std::collections::HashMap::new();

    // Query each table for unique agents and their client counts
    for (_dataset_id, table_name) in datasets {
        // Check if Agent column exists in this table
        let check_column: Result<(), _> = conn.query_row(
            &format!("SELECT \"Agent\" FROM \"{}\" LIMIT 1", table_name),
            [],
            |_| Ok(()),
        );

        if check_column.is_err() {
            // This table doesn't have an Agent column, skip it
            continue;
        }

        // Get unique agents and their distinct client counts for this table
        let query = format!(
            "SELECT \"Agent\", COUNT(DISTINCT \"Client\") as client_count \
             FROM \"{}\" \
             WHERE \"Agent\" IS NOT NULL AND \"Agent\" != '' \
             GROUP BY \"Agent\"",
            table_name
        );

        let mut table_stmt = conn.prepare(&query)
            .map_err(|e| format!("Failed to prepare query for table {}: {}", table_name, e))?;

        let rows = table_stmt
            .query_map([], |row| {
                let agent: String = row.get(0)?;
                let count: i64 = row.get(1)?;
                Ok((agent, count))
            })
            .map_err(|e| format!("Failed to query agents from table {}: {}", table_name, e))?;

        for row in rows {
            if let Ok((agent, count)) = row {
                *agents.entry(agent).or_insert(0) += count;
            }
        }
    }

    // Convert to sorted Vec<AgentInfo>
    let mut result: Vec<AgentInfo> = agents
        .into_iter()
        .map(|(name, client_count)| AgentInfo { name, client_count })
        .collect();

    result.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(result)
}

/// Get unique agents from a specific dataset
#[tauri::command]
pub fn get_agents_for_dataset(db: State<'_, DbState>, dataset_id: i64) -> Result<Vec<AgentInfo>, String> {
    let conn = db.0.lock().map_err(|e| format!("DB lock error: {e}"))?;

    // Get the table name for this dataset
    let table_name: String = conn
        .query_row(
            "SELECT table_name FROM datasets WHERE id = ?1",
            params![dataset_id],
            |r| r.get(0),
        )
        .map_err(|e| format!("Dataset not found: {e}"))?;

    // Check if Agent column exists
    let check_column: Result<(), _> = conn.query_row(
        &format!("SELECT \"Agent\" FROM \"{}\" LIMIT 1", table_name),
        [],
        |_| Ok(()),
    );

    if check_column.is_err() {
        // This table doesn't have an Agent column
        return Ok(Vec::new());
    }

    // Get unique agents and their distinct client counts
    let query = format!(
        "SELECT \"Agent\", COUNT(DISTINCT \"Client\") as client_count \
         FROM \"{}\" \
         WHERE \"Agent\" IS NOT NULL AND \"Agent\" != '' \
         GROUP BY \"Agent\" \
         ORDER BY \"Agent\"",
        table_name
    );

    let mut stmt = conn.prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {e}"))?;

    let rows = stmt
        .query_map([], |row| {
            let agent: String = row.get(0)?;
            let count: i64 = row.get(1)?;
            Ok(AgentInfo { name: agent, client_count: count })
        })
        .map_err(|e| format!("Failed to query agents: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to parse agents: {e}"))?;

    Ok(rows)
}

/// Generate EPro report rows for a specific agent, year, and dataset.
///
/// This is the shared calculation kernel used by both the single-agent
/// page view and the "Export All" workbook. Using the same code path
/// guarantees that what the user sees on screen matches what gets exported.
fn generate_report_rows(
    conn: &rusqlite::Connection,
    agent_name: &str,
    year: i32,
    dataset_id: i64,
) -> Result<Vec<EppRow>, String> {
    let table_name: String = conn
        .query_row(
            "SELECT table_name FROM datasets WHERE id = ?1",
            params![dataset_id],
            |r| r.get(0),
        )
        .map_err(|e| format!("Dataset not found: {e}"))?;

    let mut client_data: HashMap<String, ClientData> = HashMap::new();

    // Check if required columns exist
    let columns_query = format!("PRAGMA table_info(\"{}\")", table_name);
    let mut cols_stmt = conn
        .prepare(&columns_query)
        .map_err(|e| format!("Failed to check columns for table {}: {}", table_name, e))?;

    let column_names: Vec<String> = cols_stmt
        .query_map([], |row| {
            let name: String = row.get(1)?;
            Ok(name)
        })
        .map_err(|e| format!("Failed to read columns: {e}"))?
        .collect::<Result<_, _>>()
        .map_err(|e| format!("Failed to parse columns: {e}"))?;

    let has_agent = column_names.iter().any(|c| c == "Agent");
    let has_client = column_names.iter().any(|c| c == "Client");
    let has_date = column_names.iter().any(|c| c == "Data");
    let has_value = column_names.iter().any(|c| c == "Valoare_Contabila");
    let has_cod = column_names.iter().any(|c| c == "Cod");

    if !has_agent || !has_client || !has_date || !has_value {
        return Ok(Vec::new());
    }

    // Query data for this agent
    let query = if has_cod {
        format!(
            "SELECT \"Client\", \"Data\", \"Valoare_Contabila\", \"Cod\" \
             FROM \"{}\" \
             WHERE \"Agent\" = ?1",
            table_name
        )
    } else {
        format!(
            "SELECT \"Client\", \"Data\", \"Valoare_Contabila\", NULL as \"Cod\" \
             FROM \"{}\" \
             WHERE \"Agent\" = ?1",
            table_name
        )
    };

    let mut data_stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare data query: {e}"))?;

    let rows = data_stmt
        .query_map(params![agent_name], |row| {
            let client_ref = row.get_ref(0).unwrap();
            let date_ref = row.get_ref(1).unwrap();
            let value_ref = row.get_ref(2).unwrap();
            let cod_ref = row.get_ref(3).unwrap();

            let client = match client_ref {
                rusqlite::types::ValueRef::Text(s) => {
                    std::str::from_utf8(s).unwrap_or("").to_string()
                }
                _ => String::new(),
            };
            let date_str = match date_ref {
                rusqlite::types::ValueRef::Text(s) => {
                    normalize_yyyymmdd(std::str::from_utf8(s).unwrap_or(""))
                }
                rusqlite::types::ValueRef::Integer(i) => date_int_to_iso(i),
                _ => String::new(),
            };
            let value = match value_ref {
                rusqlite::types::ValueRef::Integer(i) => i as f64,
                rusqlite::types::ValueRef::Real(r) => r,
                rusqlite::types::ValueRef::Text(s) => {
                    let s_str = std::str::from_utf8(s).unwrap_or("");
                    s_str.replace(',', ".").parse().unwrap_or(0.0)
                }
                rusqlite::types::ValueRef::Null => 0.0,
                _ => 0.0,
            };
            let cod = match cod_ref {
                rusqlite::types::ValueRef::Text(s) => {
                    std::str::from_utf8(s).unwrap_or("").to_string()
                }
                rusqlite::types::ValueRef::Integer(i) => i.to_string(),
                rusqlite::types::ValueRef::Real(r) => r.to_string(),
                rusqlite::types::ValueRef::Null => String::new(),
                _ => String::new(),
            };

            Ok((client, date_str, value, cod))
        })
        .map_err(|e| format!("Failed to query data: {e}"))?;

    for row in rows {
        if let Ok((client, date_str, value, cod)) = row {
            if client.is_empty() {
                continue;
            }

            let entry = client_data
                .entry(client.trim().to_lowercase())
                .or_insert_with(|| ClientData {
                    client: client.clone(),
                    agent: agent_name.to_string(),
                    q1: 0.0,
                    q2: 0.0,
                    q3: 0.0,
                    q4: 0.0,
                    culoare_decolorare_q1: 0.0,
                    culoare_decolorare_q2: 0.0,
                    culoare_decolorare_q3: 0.0,
                    culoare_decolorare_q4: 0.0,
                    haircare_tehnic_q1: 0.0,
                    haircare_tehnic_q2: 0.0,
                    haircare_tehnic_q3: 0.0,
                    haircare_tehnic_q4: 0.0,
                });

            if value != 0.0 {
                let quarter = parse_quarter(&date_str, year);

                if let Some(q) = quarter {
                    match q {
                        1 => entry.q1 += value,
                        2 => entry.q2 += value,
                        3 => entry.q3 += value,
                        4 => entry.q4 += value,
                        _ => {}
                    }

                    if !cod.is_empty() {
                        match conn.query_row(
                            "SELECT LOWER(subgrupa) FROM subgroups WHERE LOWER(cod) = LOWER(?1) LIMIT 1",
                            params![cod],
                            |row| row.get::<_, String>(0),
                        ) {
                            Ok(subgrupa) => {
                                let subgrupa_lower = subgrupa.to_lowercase();
                                if subgrupa_lower == "culoare" || subgrupa_lower == "decolorare" {
                                    match q {
                                        1 => entry.culoare_decolorare_q1 += value,
                                        2 => entry.culoare_decolorare_q2 += value,
                                        3 => entry.culoare_decolorare_q3 += value,
                                        4 => entry.culoare_decolorare_q4 += value,
                                        _ => {}
                                    }
                                }
                                if subgrupa_lower == "haircare tehnic" {
                                    match q {
                                        1 => entry.haircare_tehnic_q1 += value,
                                        2 => entry.haircare_tehnic_q2 += value,
                                        3 => entry.haircare_tehnic_q3 += value,
                                        4 => entry.haircare_tehnic_q4 += value,
                                        _ => {}
                                    }
                                }
                            }
                            Err(_) => {}
                        }
                    }
                }
            }
        }
    }

    // If no data found for the selected year, try again without year filter
    if client_data.is_empty() {
        let fallback_query = if has_cod {
            format!(
                "SELECT \"Client\", \"Data\", \"Valoare_Contabila\", \"Cod\" \
                 FROM \"{}\" \
                 WHERE \"Agent\" = ?1",
                table_name
            )
        } else {
            format!(
                "SELECT \"Client\", \"Data\", \"Valoare_Contabila\", NULL as \"Cod\" \
                 FROM \"{}\" \
                 WHERE \"Agent\" = ?1",
                table_name
            )
        };

        let mut fallback_stmt = conn
            .prepare(&fallback_query)
            .map_err(|e| format!("Failed to prepare fallback query: {e}"))?;

        let fallback_rows = fallback_stmt
            .query_map(params![agent_name], |row| {
                let client_ref = row.get_ref(0).unwrap();
                let date_ref = row.get_ref(1).unwrap();
                let value_ref = row.get_ref(2).unwrap();
                let cod_ref = row.get_ref(3).unwrap();

                let client = match client_ref {
                    rusqlite::types::ValueRef::Text(s) => {
                        std::str::from_utf8(s).unwrap_or("").to_string()
                    }
                    _ => String::new(),
                };
                let date_str = match date_ref {
                    rusqlite::types::ValueRef::Text(s) => {
                        normalize_yyyymmdd(std::str::from_utf8(s).unwrap_or(""))
                    }
                    rusqlite::types::ValueRef::Integer(i) => date_int_to_iso(i),
                    _ => String::new(),
                };
                let value = match value_ref {
                    rusqlite::types::ValueRef::Integer(i) => i as f64,
                    rusqlite::types::ValueRef::Real(r) => r,
                    rusqlite::types::ValueRef::Text(s) => {
                        let s_str = std::str::from_utf8(s).unwrap_or("");
                        s_str.replace(',', ".").parse().unwrap_or(0.0)
                    }
                    rusqlite::types::ValueRef::Null => 0.0,
                    _ => 0.0,
                };
                let cod = match cod_ref {
                    rusqlite::types::ValueRef::Text(s) => {
                        std::str::from_utf8(s).unwrap_or("").to_string()
                    }
                    rusqlite::types::ValueRef::Integer(i) => i.to_string(),
                    rusqlite::types::ValueRef::Real(r) => r.to_string(),
                    rusqlite::types::ValueRef::Null => String::new(),
                    _ => String::new(),
                };

                Ok((client, date_str, value, cod))
            })
            .map_err(|e| format!("Failed to query fallback data: {e}"))?;

        for row in fallback_rows {
            if let Ok((client, date_str, value, cod)) = row {
                if client.is_empty() {
                    continue;
                }

                let entry = client_data
                    .entry(client.trim().to_lowercase())
                    .or_insert_with(|| ClientData {
                        client: client.clone(),
                        agent: agent_name.to_string(),
                        q1: 0.0,
                        q2: 0.0,
                        q3: 0.0,
                        q4: 0.0,
                        culoare_decolorare_q1: 0.0,
                        culoare_decolorare_q2: 0.0,
                        culoare_decolorare_q3: 0.0,
                        culoare_decolorare_q4: 0.0,
                        haircare_tehnic_q1: 0.0,
                        haircare_tehnic_q2: 0.0,
                        haircare_tehnic_q3: 0.0,
                        haircare_tehnic_q4: 0.0,
                    });

                if value != 0.0 {
                    let date = parse_date_flexible(&date_str);
                    if let Some(d) = date {
                        let month = d.month() as u32;
                        let subgrupa_lower = if !cod.is_empty() {
                            conn.query_row(
                                "SELECT LOWER(subgrupa) FROM subgroups WHERE LOWER(cod) = LOWER(?1) LIMIT 1",
                                params![cod],
                                |row| row.get::<_, String>(0),
                            )
                            .ok()
                        } else {
                            None
                        };

                        match month {
                            1..=3 => {
                                entry.q1 += value;
                                if let Some(ref subgrupa) = subgrupa_lower {
                                    if subgrupa == "culoare" || subgrupa == "decolorare" {
                                        entry.culoare_decolorare_q1 += value;
                                    }
                                    if subgrupa == "haircare tehnic" {
                                        entry.haircare_tehnic_q1 += value;
                                    }
                                }
                            }
                            4..=6 => {
                                entry.q2 += value;
                                if let Some(ref subgrupa) = subgrupa_lower {
                                    if subgrupa == "culoare" || subgrupa == "decolorare" {
                                        entry.culoare_decolorare_q2 += value;
                                    }
                                    if subgrupa == "haircare tehnic" {
                                        entry.haircare_tehnic_q2 += value;
                                    }
                                }
                            }
                            7..=9 => {
                                entry.q3 += value;
                                if let Some(ref subgrupa) = subgrupa_lower {
                                    if subgrupa == "culoare" || subgrupa == "decolorare" {
                                        entry.culoare_decolorare_q3 += value;
                                    }
                                    if subgrupa == "haircare tehnic" {
                                        entry.haircare_tehnic_q3 += value;
                                    }
                                }
                            }
                            10..=12 => {
                                entry.q4 += value;
                                if let Some(ref subgrupa) = subgrupa_lower {
                                    if subgrupa == "culoare" || subgrupa == "decolorare" {
                                        entry.culoare_decolorare_q4 += value;
                                    }
                                    if subgrupa == "haircare tehnic" {
                                        entry.haircare_tehnic_q4 += value;
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                }
            }
        }
    }

    // Look up TY 2025 totals for this agent
    let mut ty_totals = lookup_ty_2025_totals(conn, agent_name);

    // Load client combinations for this agent
    let combinations = load_combinations_for_agent(conn, agent_name);
    let mut combined_map: HashMap<String, Vec<String>> = HashMap::new();
    let mut member_keys: HashSet<String> = HashSet::new();

    for combo in &combinations {
        let member_keys_list: Vec<String> = combo.members.iter().map(|m| m.client_key.clone()).collect();
        let display_name = combo
            .members
            .iter()
            .map(|m| m.client_name.as_str())
            .collect::<Vec<_>>()
            .join(" + ");

        for key in &member_keys_list {
            member_keys.insert(key.clone());
        }
        combined_map.insert(display_name, member_keys_list);
    }

    // Merge combination totals from raw client data
    for (display_name, member_keys_list) in &combined_map {
        let mut merged = ClientData {
            client: display_name.clone(),
            agent: agent_name.to_string(),
            q1: 0.0,
            q2: 0.0,
            q3: 0.0,
            q4: 0.0,
            culoare_decolorare_q1: 0.0,
            culoare_decolorare_q2: 0.0,
            culoare_decolorare_q3: 0.0,
            culoare_decolorare_q4: 0.0,
            haircare_tehnic_q1: 0.0,
            haircare_tehnic_q2: 0.0,
            haircare_tehnic_q3: 0.0,
            haircare_tehnic_q4: 0.0,
        };

        for key in member_keys_list {
            if let Some(member_data) = client_data.get(key) {
                merged.q1 += member_data.q1;
                merged.q2 += member_data.q2;
                merged.q3 += member_data.q3;
                merged.q4 += member_data.q4;
                merged.culoare_decolorare_q1 += member_data.culoare_decolorare_q1;
                merged.culoare_decolorare_q2 += member_data.culoare_decolorare_q2;
                merged.culoare_decolorare_q3 += member_data.culoare_decolorare_q3;
                merged.culoare_decolorare_q4 += member_data.culoare_decolorare_q4;
                merged.haircare_tehnic_q1 += member_data.haircare_tehnic_q1;
                merged.haircare_tehnic_q2 += member_data.haircare_tehnic_q2;
                merged.haircare_tehnic_q3 += member_data.haircare_tehnic_q3;
                merged.haircare_tehnic_q4 += member_data.haircare_tehnic_q4;
            }
        }

        client_data.insert(display_name.clone(), merged);

        // Merge TY 2025 totals for the combination
        let summed_ty: f64 = member_keys_list
            .iter()
            .map(|k| ty_totals.get(k).copied().unwrap_or(0.0))
            .sum();
        ty_totals.insert(display_name.to_lowercase(), summed_ty);
    }

    // Remove individual member rows (they are now represented by combined rows)
    for key in &member_keys {
        client_data.remove(key);
    }

    // Convert to EppRow with calculations
    let mut rows: Vec<EppRow> = client_data
        .into_values()
        .map(|data| {
            let total_anual = data.q1 + data.q2 + data.q3 + data.q4;
            let reducere = total_anual * 0.925;
            let total = reducere;
            let (program, procent) = calculate_program(total);

            let suma_bonus = data.culoare_decolorare_q1
                + data.culoare_decolorare_q2
                + data.culoare_decolorare_q3
                + data.culoare_decolorare_q4
                + data.haircare_tehnic_q1
                + data.haircare_tehnic_q2
                + data.haircare_tehnic_q3
                + data.haircare_tehnic_q4;
            let suma_bonus_reducere = suma_bonus * 0.925;

            let total_2025 = ty_totals
                .get(&data.client.trim().to_lowercase())
                .copied()
                .unwrap_or(0.0);
            let vs_2025_2026 = total_anual - total_2025;
            let bonus_crestere = if vs_2025_2026 > 0.0 { 2.0 } else { 0.0 };

            let procent_num = procent.trim_end_matches('%').parse::<f64>().unwrap_or(0.0);
            let total_bonus = procent_num + bonus_crestere;
            let suma_voucher = (total_bonus / 100.0) * suma_bonus_reducere;

            let is_comb = combined_map.contains_key(&data.client);
            let source = if is_comb {
                combined_map.get(&data.client).cloned().unwrap_or_default()
            } else {
                vec![]
            };

            EppRow {
                client: data.client,
                agent: data.agent,
                q1_total: data.q1,
                q2_total: data.q2,
                q3_total: data.q3,
                q4_total: data.q4,
                total_anual,
                reducere,
                total,
                program,
                procent,
                total_2025,
                vs_2025_2026,
                bonus_crestere,
                culoare_decolorare_q1: data.culoare_decolorare_q1,
                culoare_decolorare_q2: data.culoare_decolorare_q2,
                culoare_decolorare_q3: data.culoare_decolorare_q3,
                culoare_decolorare_q4: data.culoare_decolorare_q4,
                haircare_tehnic_q1: data.haircare_tehnic_q1,
                haircare_tehnic_q2: data.haircare_tehnic_q2,
                haircare_tehnic_q3: data.haircare_tehnic_q3,
                haircare_tehnic_q4: data.haircare_tehnic_q4,
                suma_bonus,
                suma_bonus_reducere,
                total_bonus,
                suma_voucher,
                is_combined: is_comb,
                source_clients: source,
            }
        })
        .collect();

    rows.sort_by(|a, b| a.client.cmp(&b.client));
    Ok(rows)
}

/// Generate EPro report for a specific agent, year, and dataset
#[tauri::command]
pub fn generate_epp_report(
    agent_name: String,
    year: Option<i32>,
    dataset_id: Option<i64>,
    db: State<'_, DbState>,
) -> Result<EppReportResult, String> {
    let conn = db.0.lock().map_err(|e| format!("DB lock error: {e}"))?;

    let report_year = year.unwrap_or_else(|| chrono::Utc::now().year());

    // Get table names - either specific dataset or all datasets
    let table_names: Vec<String> = if let Some(ds_id) = dataset_id {
        // Use the shared calculation kernel for single-dataset calls
        let rows = generate_report_rows(&conn, &agent_name, report_year, ds_id)?;
        return Ok(EppReportResult {
            agent_name,
            year: report_year,
            rows,
        });
    } else {
        // Get all dataset tables (for backwards compatibility)
        let mut stmt = conn
            .prepare("SELECT table_name FROM datasets ORDER BY name")
            .map_err(|e| format!("Failed to query datasets: {e}"))?;

        let rows = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| format!("Failed to read dataset names: {e}"))?
            .collect::<Result<Vec<String>, _>>()
            .map_err(|e| format!("Failed to parse dataset names: {e}"))?;

        rows
    };

    // Debug: log what we're querying
    eprintln!("DEBUG: generate_epp_report called with agent='{}', year={}, dataset_id={:?}", agent_name, report_year, dataset_id);
    eprintln!("DEBUG: table_names={:?}", table_names);

    let mut client_data: std::collections::HashMap<String, ClientData> = std::collections::HashMap::new();

    // Query each table for data matching the agent
    for table_name in &table_names {
        // Check if required columns exist
        let columns_query = format!("PRAGMA table_info(\"{}\")", table_name);
        let mut cols_stmt = conn.prepare(&columns_query)
            .map_err(|e| format!("Failed to check columns for table {}: {}", table_name, e))?;

        let column_names: Vec<String> = cols_stmt
            .query_map([], |row| {
                let name: String = row.get(1)?;
                Ok(name)
            })
            .map_err(|e| format!("Failed to read columns: {e}"))?
            .collect::<Result<_, _>>()
            .map_err(|e| format!("Failed to parse columns: {e}"))?;

        eprintln!("DEBUG: Table '{}' has columns: {:?}", table_name, column_names);

        let has_agent = column_names.iter().any(|c| c == "Agent");
        let has_client = column_names.iter().any(|c| c == "Client");
        let has_date = column_names.iter().any(|c| c == "Data");
        let has_value = column_names.iter().any(|c| c == "Valoare_Contabila");
        let has_cod = column_names.iter().any(|c| c == "Cod");

        eprintln!("DEBUG: has_agent={}, has_client={}, has_date={}, has_value={}, has_cod={}",
            has_agent, has_client, has_date, has_value, has_cod);

        if !has_agent || !has_client || !has_date || !has_value {
            eprintln!("DEBUG: Skipping table '{}' - missing required columns", table_name);
            continue;
        }

        // Query data for this agent and year
        // Include Cod column if it exists, otherwise use NULL
        let query = if has_cod {
            format!(
                "SELECT \"Client\", \"Data\", \"Valoare_Contabila\", \"Cod\" \
                 FROM \"{}\" \
                 WHERE \"Agent\" = ?1",
                table_name
            )
        } else {
            format!(
                "SELECT \"Client\", \"Data\", \"Valoare_Contabila\", NULL as \"Cod\" \
                 FROM \"{}\" \
                 WHERE \"Agent\" = ?1",
                table_name
            )
        };

        let mut data_stmt = conn.prepare(&query)
            .map_err(|e| format!("Failed to prepare data query: {e}"))?;

        let row_count: Result<i64, _> = conn.query_row(
            &format!("SELECT COUNT(*) FROM \"{}\" WHERE \"Agent\" = ?1", table_name),
            params![agent_name],
            |r| r.get(0)
        );

        if let Ok(count) = row_count {
            eprintln!("DEBUG: Table '{}' has {} rows for agent '{}'", table_name, count, agent_name);
        }

        let rows = data_stmt
            .query_map(params![agent_name], |row| {
                // Try using get_ref to see actual column data
                let client_ref = row.get_ref(0).unwrap(); // First column: Client
                let date_ref = row.get_ref(1).unwrap();   // Second column: Data
                let value_ref = row.get_ref(2).unwrap();  // Third column: Valoare_Contabila
                let cod_ref = row.get_ref(3).unwrap();    // Fourth column: Cod

                eprintln!("DEBUG: Ref - client={:?}, date={:?}, value={:?}, cod={:?}",
                    client_ref, date_ref, value_ref, cod_ref);

                let client = match client_ref {
                    rusqlite::types::ValueRef::Text(s) => {
                        std::str::from_utf8(s).unwrap_or("").to_string()
                    }
                    _ => String::new()
                };
                let date_str = match date_ref {
                    rusqlite::types::ValueRef::Text(s) => {
                        normalize_yyyymmdd(std::str::from_utf8(s).unwrap_or(""))
                    }
                    rusqlite::types::ValueRef::Integer(i) => {
                        date_int_to_iso(i)
                    }
                    _ => String::new()
                };

                let value = match value_ref {
                    rusqlite::types::ValueRef::Integer(i) => i as f64,
                    rusqlite::types::ValueRef::Real(r) => r,
                    rusqlite::types::ValueRef::Text(s) => {
                        let s_str = std::str::from_utf8(s).unwrap_or("");
                        s_str.replace(',', ".").parse().unwrap_or(0.0)
                    }
                    rusqlite::types::ValueRef::Null => 0.0,
                    _ => 0.0,
                };

                let cod = match cod_ref {
                    rusqlite::types::ValueRef::Text(s) => {
                        std::str::from_utf8(s).unwrap_or("").to_string()
                    }
                    rusqlite::types::ValueRef::Integer(i) => {
                        i.to_string()
                    }
                    rusqlite::types::ValueRef::Real(r) => {
                        r.to_string()
                    }
                    rusqlite::types::ValueRef::Null => String::new(),
                    _ => String::new()
                };

                Ok((client, date_str, value, cod))
            })
            .map_err(|e| format!("Failed to query data: {e}"))?;

        let mut row_count = 0;
        for row in rows {
            row_count += 1;
            if let Ok((client, date_str, value, cod)) = row {
                // Show first 3 rows as samples
                if row_count <= 3 {
                    eprintln!("DEBUG: Sample row {} - client='{}', date='{}', value={}, cod='{}'",
                        row_count, client, date_str, value, cod);
                }

                if client.is_empty() {
                    continue;
                }

                // Always create an entry for this client, even if value is 0
                let entry = client_data.entry(client.trim().to_lowercase()).or_insert_with(|| ClientData {
                    client: client.clone(),
                    agent: agent_name.clone(),
                    q1: 0.0,
                    q2: 0.0,
                    q3: 0.0,
                    q4: 0.0,
                    culoare_decolorare_q1: 0.0,
                    culoare_decolorare_q2: 0.0,
                    culoare_decolorare_q3: 0.0,
                    culoare_decolorare_q4: 0.0,
                    haircare_tehnic_q1: 0.0,
                    haircare_tehnic_q2: 0.0,
                    haircare_tehnic_q3: 0.0,
                    haircare_tehnic_q4: 0.0,
                });

                // Only add value if it's non-zero and date matches
                if value != 0.0 {
                    let quarter = parse_quarter(&date_str, report_year);

                    if let Some(q) = quarter {
                        match q {
                            1 => entry.q1 += value,
                            2 => entry.q2 += value,
                            3 => entry.q3 += value,
                            4 => entry.q4 += value,
                            _ => {}
                        }

                        // Culoare+Decolorare and Haircare Tehnic calculation (single query)
                        if !cod.is_empty() {
                            match conn.query_row(
                                "SELECT LOWER(subgrupa) FROM subgroups WHERE LOWER(cod) = LOWER(?1) LIMIT 1",
                                params![cod],
                                |row| row.get::<_, String>(0)
                            ) {
                                Ok(subgrupa) => {
                                    let subgrupa_lower = subgrupa.to_lowercase();
                                    // Check for Culoare or Decolorare
                                    if subgrupa_lower == "culoare" || subgrupa_lower == "decolorare" {
                                        match q {
                                            1 => entry.culoare_decolorare_q1 += value,
                                            2 => entry.culoare_decolorare_q2 += value,
                                            3 => entry.culoare_decolorare_q3 += value,
                                            4 => entry.culoare_decolorare_q4 += value,
                                            _ => {}
                                        }
                                    }
                                    // Check for Haircare Tehnic
                                    if subgrupa_lower == "haircare tehnic" {
                                        match q {
                                            1 => entry.haircare_tehnic_q1 += value,
                                            2 => entry.haircare_tehnic_q2 += value,
                                            3 => entry.haircare_tehnic_q3 += value,
                                            4 => entry.haircare_tehnic_q4 += value,
                                            _ => {}
                                        }
                                    }
                                }
                                Err(_) => {
                                    // No subgroup found - treated as 0 for both categories
                                }
                            }
                        }
                    } else {
                        // Debug: log why date parsing failed
                        eprintln!("DEBUG: Date '{}' didn't parse to quarter for year {}", date_str, report_year);
                    }
                }
            }
        }
    }

    // If no data found for the selected year, try again without year filter
    if client_data.is_empty() {
        for table_name in &table_names {
            // Skip tables that don't have required columns
            let columns_query = format!("PRAGMA table_info(\"{}\")", table_name);
            let mut cols_stmt = conn.prepare(&columns_query)
                .map_err(|e| format!("Failed to check columns for table {}: {}", table_name, e))?;

            let column_names: Vec<String> = cols_stmt
                .query_map([], |row| row.get(1))
                .map_err(|e| format!("Failed to read columns: {e}"))?
                .collect::<Result<_, _>>()
                .map_err(|e| format!("Failed to parse columns: {e}"))?;

            let has_agent = column_names.iter().any(|c| c == "Agent");
            let has_client = column_names.iter().any(|c| c == "Client");
            let has_date = column_names.iter().any(|c| c == "Data");
            let has_value = column_names.iter().any(|c| c == "Valoare_Contabila");
            let has_cod = column_names.iter().any(|c| c == "Cod");

            if !has_agent || !has_client || !has_date || !has_value {
                continue;
            }

            // Query without year filter - just get all data for this agent
            // Include Cod column if it exists, otherwise use NULL
            let query = if has_cod {
                format!(
                    "SELECT \"Client\", \"Data\", \"Valoare_Contabila\", \"Cod\" \
                     FROM \"{}\" \
                     WHERE \"Agent\" = ?1",
                    table_name
                )
            } else {
                format!(
                    "SELECT \"Client\", \"Data\", \"Valoare_Contabila\", NULL as \"Cod\" \
                     FROM \"{}\" \
                     WHERE \"Agent\" = ?1",
                    table_name
                )
            };

            let mut data_stmt = conn.prepare(&query)
                .map_err(|e| format!("Failed to prepare data query: {e}"))?;

            let rows = data_stmt
                .query_map(params![agent_name], |row| {
                    // Use get_ref to handle both Text and Integer dates
                    let client_ref = row.get_ref(0).unwrap();
                    let date_ref = row.get_ref(1).unwrap();
                    let value_ref = row.get_ref(2).unwrap();
                    let cod_ref = row.get_ref(3).unwrap();

                    let client = match client_ref {
                        rusqlite::types::ValueRef::Text(s) => {
                            std::str::from_utf8(s).unwrap_or("").to_string()
                        }
                        _ => String::new()
                    };

                    let date_str = match date_ref {
                        rusqlite::types::ValueRef::Text(s) => {
                            let raw = std::str::from_utf8(s).unwrap_or("");
                            normalize_yyyymmdd(raw)
                        }
                        rusqlite::types::ValueRef::Integer(i) => {
                            date_int_to_iso(i)
                        }
                        _ => String::new()
                    };

                    let value = match value_ref {
                        rusqlite::types::ValueRef::Integer(i) => i as f64,
                        rusqlite::types::ValueRef::Real(r) => r,
                        rusqlite::types::ValueRef::Text(s) => {
                            let s_str = std::str::from_utf8(s).unwrap_or("");
                            s_str.replace(',', ".").parse().unwrap_or(0.0)
                        }
                        rusqlite::types::ValueRef::Null => 0.0,
                        _ => 0.0,
                    };

                    let cod = match cod_ref {
                        rusqlite::types::ValueRef::Text(s) => {
                            std::str::from_utf8(s).unwrap_or("").to_string()
                        }
                        rusqlite::types::ValueRef::Integer(i) => {
                            i.to_string()
                        }
                        rusqlite::types::ValueRef::Real(r) => {
                            r.to_string()
                        }
                        rusqlite::types::ValueRef::Null => String::new(),
                        _ => String::new()
                    };

                    Ok((client, date_str, value, cod))
                })
                .map_err(|e| format!("Failed to query data: {e}"))?;

            for row in rows {
                if let Ok((client, date_str, value, cod)) = row {
                    if client.is_empty() {
                        continue;
                    }

                    // Always create entry, even with zero value
                    let entry = client_data.entry(client.trim().to_lowercase()).or_insert_with(|| ClientData {
                        client: client.clone(),
                        agent: agent_name.clone(),
                        q1: 0.0,
                        q2: 0.0,
                        q3: 0.0,
                        q4: 0.0,
                        culoare_decolorare_q1: 0.0,
                        culoare_decolorare_q2: 0.0,
                        culoare_decolorare_q3: 0.0,
                        culoare_decolorare_q4: 0.0,
                        haircare_tehnic_q1: 0.0,
                        haircare_tehnic_q2: 0.0,
                        haircare_tehnic_q3: 0.0,
                        haircare_tehnic_q4: 0.0,
                    });

                    // Only add value if it's non-zero and date parses
                    if value != 0.0 {
                        let date = parse_date_flexible(&date_str);

                        if let Some(d) = date {
                            let month = d.month() as u32;

                            // Query subgrupa once per row (more efficient)
                            let subgrupa_lower = if !cod.is_empty() {
                                conn.query_row(
                                    "SELECT LOWER(subgrupa) FROM subgroups WHERE LOWER(cod) = LOWER(?1) LIMIT 1",
                                    params![cod],
                                    |row| row.get::<_, String>(0)
                                ).ok()
                            } else {
                                None
                            };

                            match month {
                                1..=3 => {
                                    entry.q1 += value;
                                    if let Some(ref subgrupa) = subgrupa_lower {
                                        if subgrupa == "culoare" || subgrupa == "decolorare" {
                                            entry.culoare_decolorare_q1 += value;
                                        }
                                        if subgrupa == "haircare tehnic" {
                                            entry.haircare_tehnic_q1 += value;
                                        }
                                    }
                                }
                                4..=6 => {
                                    entry.q2 += value;
                                    if let Some(ref subgrupa) = subgrupa_lower {
                                        if subgrupa == "culoare" || subgrupa == "decolorare" {
                                            entry.culoare_decolorare_q2 += value;
                                        }
                                        if subgrupa == "haircare tehnic" {
                                            entry.haircare_tehnic_q2 += value;
                                        }
                                    }
                                }
                                7..=9 => {
                                    entry.q3 += value;
                                    if let Some(ref subgrupa) = subgrupa_lower {
                                        if subgrupa == "culoare" || subgrupa == "decolorare" {
                                            entry.culoare_decolorare_q3 += value;
                                        }
                                        if subgrupa == "haircare tehnic" {
                                            entry.haircare_tehnic_q3 += value;
                                        }
                                    }
                                }
                                10..=12 => {
                                    entry.q4 += value;
                                    if let Some(ref subgrupa) = subgrupa_lower {
                                        if subgrupa == "culoare" || subgrupa == "decolorare" {
                                            entry.culoare_decolorare_q4 += value;
                                        }
                                        if subgrupa == "haircare tehnic" {
                                            entry.haircare_tehnic_q4 += value;
                                        }
                                    }
                                }
                                _ => {}
                            }
                        }
                    }
                }
            }
        }
    }

    // Look up TY 2025 totals for this agent
    let mut ty_totals = lookup_ty_2025_totals(&conn, &agent_name);

    // Load client combinations for this agent
    let combinations = load_combinations_for_agent(&conn, &agent_name);
    let mut combined_map: HashMap<String, Vec<String>> = HashMap::new();
    let mut member_keys: HashSet<String> = HashSet::new();

    for combo in &combinations {
        let member_keys_list: Vec<String> = combo.members.iter().map(|m| m.client_key.clone()).collect();
        let display_name = combo.members.iter()
            .map(|m| m.client_name.as_str())
            .collect::<Vec<_>>()
            .join(" + ");

        for key in &member_keys_list {
            member_keys.insert(key.clone());
        }
        combined_map.insert(display_name, member_keys_list);
    }

    // Merge combination totals from raw client data
    for (display_name, member_keys_list) in &combined_map {
        let mut merged = ClientData {
            client: display_name.clone(),
            agent: agent_name.clone(),
            q1: 0.0,
            q2: 0.0,
            q3: 0.0,
            q4: 0.0,
            culoare_decolorare_q1: 0.0,
            culoare_decolorare_q2: 0.0,
            culoare_decolorare_q3: 0.0,
            culoare_decolorare_q4: 0.0,
            haircare_tehnic_q1: 0.0,
            haircare_tehnic_q2: 0.0,
            haircare_tehnic_q3: 0.0,
            haircare_tehnic_q4: 0.0,
        };

        for key in member_keys_list {
            if let Some(member_data) = client_data.get(key) {
                merged.q1 += member_data.q1;
                merged.q2 += member_data.q2;
                merged.q3 += member_data.q3;
                merged.q4 += member_data.q4;
                merged.culoare_decolorare_q1 += member_data.culoare_decolorare_q1;
                merged.culoare_decolorare_q2 += member_data.culoare_decolorare_q2;
                merged.culoare_decolorare_q3 += member_data.culoare_decolorare_q3;
                merged.culoare_decolorare_q4 += member_data.culoare_decolorare_q4;
                merged.haircare_tehnic_q1 += member_data.haircare_tehnic_q1;
                merged.haircare_tehnic_q2 += member_data.haircare_tehnic_q2;
                merged.haircare_tehnic_q3 += member_data.haircare_tehnic_q3;
                merged.haircare_tehnic_q4 += member_data.haircare_tehnic_q4;
            }
        }

        client_data.insert(display_name.clone(), merged);

        // Merge TY 2025 totals for the combination
        let summed_ty: f64 = member_keys_list.iter()
            .map(|k| ty_totals.get(k).copied().unwrap_or(0.0))
            .sum();
        ty_totals.insert(display_name.to_lowercase(), summed_ty);
    }

    // Remove individual member rows (they are now represented by combined rows)
    for key in &member_keys {
        client_data.remove(key);
    }

    // Convert to EppRow with calculations
    let mut rows: Vec<EppRow> = client_data
        .into_values()
        .map(|data| {
            let total_anual = data.q1 + data.q2 + data.q3 + data.q4;
            let reducere = total_anual * 0.925; // 7.5% reduction
            let total = reducere;

            let (program, procent) = calculate_program(total);

            // Calculate suma_bonus (sum of all Colorare + Decolorare and Tehnic quarterly values)
            let suma_bonus = data.culoare_decolorare_q1 + data.culoare_decolorare_q2
                + data.culoare_decolorare_q3 + data.culoare_decolorare_q4
                + data.haircare_tehnic_q1 + data.haircare_tehnic_q2
                + data.haircare_tehnic_q3 + data.haircare_tehnic_q4;
            let suma_bonus_reducere = suma_bonus * 0.925; // 7.5% reduction

        let total_2025 = ty_totals.get(&data.client.trim().to_lowercase()).copied().unwrap_or(0.0);
        let vs_2025_2026 = total_anual - total_2025;
        let bonus_crestere = if vs_2025_2026 > 0.0 { 2.0 } else { 0.0 };

        let procent_num = procent
            .trim_end_matches('%')
            .parse::<f64>()
            .unwrap_or(0.0);
        let total_bonus = procent_num + bonus_crestere;
        let suma_voucher = (total_bonus / 100.0) * suma_bonus_reducere;

            let is_comb = combined_map.contains_key(&data.client);
            let source = if is_comb {
                combined_map.get(&data.client).cloned().unwrap_or_default()
            } else {
                vec![]
            };

            EppRow {
                client: data.client,
                agent: data.agent,
                q1_total: data.q1,
                q2_total: data.q2,
                q3_total: data.q3,
                q4_total: data.q4,
                total_anual,
                reducere,
                total,
                program,
                procent,
                total_2025,
                vs_2025_2026,
                bonus_crestere,
                culoare_decolorare_q1: data.culoare_decolorare_q1,
                culoare_decolorare_q2: data.culoare_decolorare_q2,
                culoare_decolorare_q3: data.culoare_decolorare_q3,
                culoare_decolorare_q4: data.culoare_decolorare_q4,
                haircare_tehnic_q1: data.haircare_tehnic_q1,
                haircare_tehnic_q2: data.haircare_tehnic_q2,
                haircare_tehnic_q3: data.haircare_tehnic_q3,
                haircare_tehnic_q4: data.haircare_tehnic_q4,
                suma_bonus,
                suma_bonus_reducere,
                total_bonus,
                suma_voucher,
                is_combined: is_comb,
                source_clients: source,
            }
        })
        .collect();

    // Sort by client name
    rows.sort_by(|a, b| a.client.cmp(&b.client));

    Ok(EppReportResult {
        agent_name,
        year: report_year,
        rows,
    })
}

/// Holds quarterly totals for a client
struct ClientData {
    client: String,
    agent: String,
    q1: f64,
    q2: f64,
    q3: f64,
    q4: f64,
    culoare_decolorare_q1: f64,
    culoare_decolorare_q2: f64,
    culoare_decolorare_q3: f64,
    culoare_decolorare_q4: f64,
    haircare_tehnic_q1: f64,
    haircare_tehnic_q2: f64,
    haircare_tehnic_q3: f64,
    haircare_tehnic_q4: f64,
}

/// Normalize date string by padding single-digit days/months with leading zeros
fn normalize_date(date_str: &str) -> String {
    let trimmed = date_str.trim();

    if trimmed.matches('/').count() == 2 {
        let parts: Vec<&str> = trimmed.split('/').collect();
        if parts.len() == 3 {
            let day = parts[0].trim();
            let month = parts[1].trim();
            let year = parts[2].trim();

            let day_padded = if day.len() == 1 { format!("0{}", day) } else { day.to_string() };
            let month_padded = if month.len() == 1 { format!("0{}", month) } else { month.to_string() };

            return format!("{}/{}/{}", day_padded, month_padded, year);
        }
    } else if trimmed.matches('-').count() == 2 {
        let parts: Vec<&str> = trimmed.split('-').collect();
        if parts.len() == 3 {
            let day = parts[0].trim();
            let month = parts[1].trim();
            let year = parts[2].trim();

            let day_padded = if day.len() == 1 { format!("0{}", day) } else { day.to_string() };
            let month_padded = if month.len() == 1 { format!("0{}", month) } else { month.to_string() };

            return format!("{}-{}-{}", day_padded, month_padded, year);
        }
    }

    trimmed.to_string()
}

/// Convert an integer date value to ISO date string (YYYY-MM-DD).
///
/// Handles two formats:
/// - YYYYMMDD integers (e.g., 20250306) — produced by recent XLSX imports
/// - Excel serial dates (e.g., 45859) — produced by older imports
fn date_int_to_iso(value: i64) -> String {
    // Check if this looks like a YYYYMMDD integer
    if value >= 19000101 && value <= 21001231 {
        let year = (value / 10000) as i32;
        let month = ((value / 100) % 100) as u32;
        let day = (value % 100) as u32;
        if let Some(_date) = NaiveDate::from_ymd_opt(year, month, day) {
            return format!("{:04}-{:02}-{:02}", year, month, day);
        }
    }

    // Otherwise treat as Excel serial date
    if let Some(duration) = Duration::try_days(value) {
        if let Some(date) = NaiveDate::from_ymd_opt(1899, 12, 30) {
            if let Some(result) = date.checked_add_signed(duration) {
                return result.format("%Y-%m-%d").to_string();
            }
        }
    }
    String::new()
}

/// Normalize a date string that might be in YYYYMMDD format (no separators).
/// Converts "20250306" → "2025-03-06". Passes through other formats unchanged.
fn normalize_yyyymmdd(s: &str) -> String {
    let trimmed = s.trim();
    if trimmed.len() == 8 && trimmed.chars().all(|c| c.is_ascii_digit()) {
        let year: i32 = trimmed[..4].parse().unwrap_or(0);
        let month: u32 = trimmed[4..6].parse().unwrap_or(0);
        let day: u32 = trimmed[6..8].parse().unwrap_or(0);
        if year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31 {
            return format!("{:04}-{:02}-{:02}", year, month, day);
        }
    }
    s.to_string()
}

/// Parse a date string into a NaiveDate, trying multiple formats
fn parse_date_flexible(date_str: &str) -> Option<chrono::NaiveDate> {
    let prenormalized = normalize_yyyymmdd(date_str);
    let normalized = normalize_date(&prenormalized);

    chrono::NaiveDate::parse_from_str(&normalized, "%Y-%m-%d")
        .or_else(|_| chrono::NaiveDate::parse_from_str(&normalized, "%d/%m/%Y"))
        .or_else(|_| chrono::NaiveDate::parse_from_str(&normalized, "%d-%m-%Y"))
        .or_else(|_| chrono::NaiveDate::parse_from_str(&normalized, "%Y/%m/%d"))
        .or_else(|_| chrono::NaiveDate::parse_from_str(&normalized, "%d.%m.%Y"))
        .or_else(|_| chrono::NaiveDate::parse_from_str(&normalized, "%Y.%m.%d"))
        .or_else(|_| chrono::NaiveDate::parse_from_str(&normalized, "%m/%d/%Y"))
        .or_else(|_| chrono::NaiveDate::parse_from_str(&normalized, "%m-%d-%Y"))
        .ok()
}

/// Parse a date string and return the quarter (1-4) if it matches the report year
fn parse_quarter(date_str: &str, report_year: i32) -> Option<u32> {
    let date = parse_date_flexible(date_str)?;

    if date.year() != report_year {
        return None;
    }

    let month = date.month() as u32;
    match month {
        1..=3 => Some(1),
        4..=6 => Some(2),
        7..=9 => Some(3),
        10..=12 => Some(4),
        _ => None,
    }
}

/// Strip Romanian diacritics and lowercase for case-insensitive matching.
fn normalize_for_match(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .map(|c| match c {
            'ă' | 'â' | 'á' | 'à' | 'ä' | 'ã' | 'å' => 'a',
            'é' | 'è' | 'ê' | 'ë' => 'e',
            'î' | 'í' | 'ì' | 'ï' => 'i',
            'ó' | 'ò' | 'ô' | 'ö' | 'õ' => 'o',
            'ú' | 'ù' | 'û' | 'ü' => 'u',
            'ș' | 'ş' => 's',
            'ț' | 'ţ' => 't',
            'ñ' => 'n',
            'ç' => 'c',
            _ => c,
        })
        .collect()
}

/// Look up Total 2025 values from TY reports, keyed by (agent_name, client_name).
///
/// Scans all TY report dynamic tables that have Agent, Client, and Total columns.
/// Matches columns by checking if the normalized (lowercase, diacritic-stripped)
/// name contains keywords: "agent" for agent, "client" for client, "total" for total.
fn lookup_ty_2025_totals(conn: &rusqlite::Connection, agent_name: &str) -> HashMap<String, f64> {
    let mut totals: HashMap<String, f64> = HashMap::new();

    let ty_report_query = "SELECT table_name FROM ty_reports WHERE table_name IS NOT NULL";
    let mut stmt = match conn.prepare(ty_report_query) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("DEBUG TY: Failed to query ty_reports: {e}");
            return totals;
        }
    };

    let table_names: Vec<String> = match stmt.query_map([], |row| row.get::<_, String>(0)) {
        Ok(rows) => rows.filter_map(|r| r.ok()).collect(),
        Err(e) => {
            eprintln!("DEBUG TY: Failed to read table names: {e}");
            return totals;
        }
    };

    eprintln!("DEBUG TY: Found {} TY report tables for agent '{}'", table_names.len(), agent_name);

    for table_name in &table_names {
        let pragma_query = format!("PRAGMA table_info(\"{}\")", table_name);
        let mut cols_stmt = match conn.prepare(&pragma_query) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("DEBUG TY: Failed to PRAGMA table '{}': {e}", table_name);
                continue;
            }
        };

        let column_names: Vec<String> = match cols_stmt.query_map([], |row| row.get::<_, String>(1)) {
            Ok(rows) => rows.filter_map(|r| r.ok()).collect(),
            Err(e) => {
                eprintln!("DEBUG TY: Failed to read columns for '{}': {e}", table_name);
                continue;
            }
        };

        eprintln!("DEBUG TY: Table '{}' has columns: {:?}", table_name, column_names);

        let normalized: Vec<String> = column_names.iter().map(|c| normalize_for_match(c)).collect();

        // Find agent column: normalized name contains "agent" but NOT "nume_agent" sub-pattern
        // We use simple contains for "agent" which covers "agent", "agent_name", "nume_agent" etc.
        let agent_idx = normalized.iter().position(|c| c.contains("agent"));
        let client_idx = normalized.iter().position(|c| c.contains("client"));
        let total_idx = normalized.iter().position(|c| c.contains("total") || c.contains("valoare"));

        if let (Some(a_idx), Some(c_idx), Some(t_idx)) = (agent_idx, client_idx, total_idx) {
            let agent_actual = &column_names[a_idx];
            let client_actual = &column_names[c_idx];
            let total_actual = &column_names[t_idx];

            eprintln!(
                "DEBUG TY: Table '{}' matched — agent='{}', client='{}', total='{}'",
                table_name, agent_actual, client_actual, total_actual
            );

            // Case-insensitive agent matching
            let query = format!(
                "SELECT \"{client_actual}\", \"{total_actual}\" FROM \"{table_name}\" WHERE LOWER(\"{agent_actual}\") = LOWER(?1)"
            );

            let mut data_stmt = match conn.prepare(&query) {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("DEBUG TY: Failed to prepare query for '{}': {e}", table_name);
                    continue;
                }
            };

            let rows = match data_stmt.query_map(params![agent_name], |row| {
                let client: String = row.get(0)?;
                let total_val: f64 = row.get(1).unwrap_or(0.0);
                Ok((client, total_val))
            }) {
                Ok(r) => r,
                Err(e) => {
                    eprintln!("DEBUG TY: Failed to query data from '{}': {e}", table_name);
                    continue;
                }
            };

            let mut match_count = 0;
            for row in rows {
                if let Ok((client, total_val)) = row {
                    let key = client.trim().to_lowercase();
                    eprintln!(
                        "DEBUG TY: Row match — client='{}', total={:.2}",
                        client, total_val
                    );
                    totals.insert(key, total_val);
                    match_count += 1;
                }
            }
            eprintln!("DEBUG TY: Table '{}' matched {} rows for agent '{}'", table_name, match_count, agent_name);
        } else {
            eprintln!(
                "DEBUG TY: Table '{}' skipped — agent_idx={:?}, client_idx={:?}, total_idx={:?}",
                table_name, agent_idx, client_idx, total_idx
            );
        }
    }

    eprintln!("DEBUG TY: Final totals map has {} entries", totals.len());
    totals
}

/// Calculate program tier and percentage based on total amount
fn calculate_program(total: f64) -> (String, String) {
    if total < 18000.0 {
        ("-".to_string(), "-".to_string())
    } else if total <= 29999.0 {
        ("Starter 🌱 5%".to_string(), "5%".to_string())
    } else if total <= 49999.0 {
        ("Explorer 🚀 6%".to_string(), "6%".to_string())
    } else if total <= 74999.0 {
        ("Artist 🎨 7%".to_string(), "7%".to_string())
    } else if total <= 100000.0 {
        ("Master ⏳ 8%".to_string(), "8%".to_string())
    } else {
        ("Prestige 🌟 10%".to_string(), "10%".to_string())
    }
}

/// Load client combinations for a given agent from the database
fn load_combinations_for_agent(
    conn: &rusqlite::Connection,
    agent_name: &str,
) -> Vec<LoadedCombination> {
    let agent_key = agent_name.trim().to_lowercase();

    let mut stmt = match conn.prepare(
        "SELECT cc.id, ccm.client_name, ccm.client_key
         FROM client_combinations cc
         JOIN client_combination_members ccm ON ccm.combination_id = cc.id
         WHERE cc.agent_key = ?1
         ORDER BY cc.id, ccm.display_order",
    ) {
        Ok(s) => s,
        Err(_) => return vec![],
    };

    let rows: Vec<(i64, String, String)> = match stmt.query_map(params![agent_key], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?))
    }) {
        Ok(rows) => rows.filter_map(|r| r.ok()).collect(),
        Err(_) => return vec![],
    };

    let mut combos: Vec<LoadedCombination> = vec![];
    let mut current_id: i64 = -1;

    for (id, client_name, client_key) in rows {
        if id != current_id {
            combos.push(LoadedCombination { members: vec![] });
            current_id = id;
        }
        combos.last_mut().unwrap().members.push(LoadedMember {
            client_name,
            client_key,
        });
    }

    combos
}

struct LoadedCombination {
    members: Vec<LoadedMember>,
}

struct LoadedMember {
    client_name: String,
    client_key: String,
}

// ---------------------------------------------------------------------------
// Export All Agents
// ---------------------------------------------------------------------------

/// Export all agents for a dataset into a single multi-sheet workbook.
#[tauri::command]
pub async fn export_all_epp_reports(
    dataset_id: i64,
    year: i32,
    db: State<'_, DbState>,
    app: AppHandle,
) -> Result<String, String> {
    use std::collections::HashMap as NameMap;

    let agent_reports = {
        let conn = db.0.lock().map_err(|e| format!("DB lock error: {e}"))?;

        // Get all agents for this dataset
        let table_name: String = conn
            .query_row(
                "SELECT table_name FROM datasets WHERE id = ?1",
                params![dataset_id],
                |r| r.get(0),
            )
            .map_err(|e| format!("Dataset not found: {e}"))?;

        let query = format!(
            "SELECT \"Agent\", COUNT(DISTINCT \"Client\") as client_count \
             FROM \"{}\" \
             WHERE \"Agent\" IS NOT NULL AND \"Agent\" != '' \
             GROUP BY \"Agent\" \
             ORDER BY \"Agent\"",
            table_name
        );

        let mut stmt = conn
            .prepare(&query)
            .map_err(|e| format!("Failed to prepare agent query: {e}"))?;

        let agents: Vec<(String, i64)> = stmt
            .query_map([], |row| {
                let name: String = row.get(0)?;
                let count: i64 = row.get(1)?;
                Ok((name, count))
            })
            .map_err(|e| format!("Failed to query agents: {e}"))?
            .collect::<Result<_, _>>()
            .map_err(|e| format!("Failed to parse agents: {e}"))?;

        if agents.is_empty() {
            return Err("No agents found for the selected dataset".to_string());
        }

        // Generate all reports while the DB lock is held
        let mut reports: Vec<(String, i64, Vec<EppRow>)> = Vec::new();
        for (agent_name, client_count) in &agents {
            match generate_report_rows(&conn, agent_name, year, dataset_id) {
                Ok(rows) => {
                    reports.push((agent_name.clone(), *client_count, rows));
                }
                Err(e) => {
                    eprintln!(
                        "WARN: Failed to generate report for agent '{}': {}",
                        agent_name, e
                    );
                    // Skip agents that fail, don't abort the entire export
                }
            }
        }

        reports
    }; // DB lock released here (conn dropped)

    if agent_reports.is_empty() {
        return Err("No reports could be generated for any agent".to_string());
    }

    // Build the Excel workbook
    let mut workbook = Workbook::new();

    let header_fmt = Format::new()
        .set_bold()
        .set_border(FormatBorder::Thin)
        .set_background_color(0x4472C4)
        .set_font_color(0xFFFFFF);

    let data_fmt = Format::new().set_border(FormatBorder::Thin);

    // --- Summary sheet ---
    let summary = workbook.add_worksheet();
    summary
        .set_name("Summary")
        .map_err(|e| format!("Failed to name summary sheet: {e}"))?;

    let summary_headers = ["Agent", "Total Clients", "Total Anual"];
    for (col, name) in summary_headers.iter().enumerate() {
        summary
            .write_with_format(0, col as u16, *name, &header_fmt)
            .map_err(|e| format!("Summary header write error: {e}"))?;
    }

    for (row_idx, (agent_name, client_count, epp_rows)) in agent_reports.iter().enumerate() {
        let total_anual: f64 = epp_rows.iter().map(|r| r.total_anual).sum();
        summary
            .write_with_format(row_idx as u32 + 1, 0, agent_name.as_str(), &data_fmt)
            .map_err(|e| format!("Summary write error: {e}"))?;
        summary
            .write_with_format(row_idx as u32 + 1, 1, *client_count as f64, &data_fmt)
            .map_err(|e| format!("Summary write error: {e}"))?;
        summary
            .write_with_format(
                row_idx as u32 + 1,
                2,
                format!("{:.2} RON", total_anual).as_str(),
                &data_fmt,
            )
            .map_err(|e| format!("Summary write error: {e}"))?;
    }

    summary.autofit();

    // --- Agent sheets ---
    let agent_columns = &[
        "Client",
        "Agent",
        "Total Q1",
        "Total Q2",
        "Total Q3",
        "Total Q4",
        "Total Anual",
        "Total 7.5%",
        "Total incadrare",
        "Program incadrare",
        "Procent incadrare",
        "Total 2025",
        "2025 vs 2026",
        "Bonus crestere",
        "Culoare + Decolorare Q1",
        "Culoare + Decolorare Q2",
        "Culoare + Decolorare Q3",
        "Culoare + Decolorare Q4",
        "Tehnic Q1",
        "Tehnic Q2",
        "Tehnic Q3",
        "Tehnic Q4",
        "Suma bonus",
        "Suma calcul bonus - 7.5%",
        "Total bonus",
        "Suma voucher",
    ];

    let mut sheet_names_used: NameMap<String, usize> = NameMap::new();

    for (agent_name, _client_count, epp_rows) in &agent_reports {
        let sheet_name = make_sheet_name(agent_name, &mut sheet_names_used);
        let sheet = workbook.add_worksheet();
        sheet
            .set_name(&sheet_name)
            .map_err(|e| format!("Failed to name sheet '{sheet_name}': {e}"))?;

        // Write headers
        for (col, name) in agent_columns.iter().enumerate() {
            sheet
                .write_with_format(0, col as u16, *name, &header_fmt)
                .map_err(|e| format!("Header write error: {e}"))?;
        }

        // Write data rows
        for (row_idx, epp_row) in epp_rows.iter().enumerate() {
            let r = (row_idx + 1) as u32;

            // String fields
            sheet
                .write_with_format(r, 0, epp_row.client.as_str(), &data_fmt)
                .map_err(|e| format!("Write error: {e}"))?;
            sheet
                .write_with_format(r, 1, epp_row.agent.as_str(), &data_fmt)
                .map_err(|e| format!("Write error: {e}"))?;

            // Numeric fields
            let nums = [
                (2, epp_row.q1_total),
                (3, epp_row.q2_total),
                (4, epp_row.q3_total),
                (5, epp_row.q4_total),
                (6, epp_row.total_anual),
                (7, epp_row.reducere),
                (8, epp_row.total),
            ];
            for (col, val) in nums {
                sheet
                    .write_with_format(r, col, val, &data_fmt)
                    .map_err(|e| format!("Write error: {e}"))?;
            }

            // String fields (program & procent)
            sheet
                .write_with_format(r, 9, epp_row.program.as_str(), &data_fmt)
                .map_err(|e| format!("Write error: {e}"))?;
            sheet
                .write_with_format(r, 10, epp_row.procent.as_str(), &data_fmt)
                .map_err(|e| format!("Write error: {e}"))?;

            // Numeric: TY comparison
            let nums2 = [
                (11, epp_row.total_2025),
                (12, epp_row.vs_2025_2026),
                (13, epp_row.bonus_crestere),
            ];
            for (col, val) in nums2 {
                sheet
                    .write_with_format(r, col, val, &data_fmt)
                    .map_err(|e| format!("Write error: {e}"))?;
            }

            // Culoare + Decolorare quarterly
            let nums3 = [
                (14, epp_row.culoare_decolorare_q1),
                (15, epp_row.culoare_decolorare_q2),
                (16, epp_row.culoare_decolorare_q3),
                (17, epp_row.culoare_decolorare_q4),
            ];
            for (col, val) in nums3 {
                sheet
                    .write_with_format(r, col, val, &data_fmt)
                    .map_err(|e| format!("Write error: {e}"))?;
            }

            // Haircare Tehnic quarterly
            let nums4 = [
                (18, epp_row.haircare_tehnic_q1),
                (19, epp_row.haircare_tehnic_q2),
                (20, epp_row.haircare_tehnic_q3),
                (21, epp_row.haircare_tehnic_q4),
            ];
            for (col, val) in nums4 {
                sheet
                    .write_with_format(r, col, val, &data_fmt)
                    .map_err(|e| format!("Write error: {e}"))?;
            }

            // Bonus fields (numeric)
            let nums5 = [
                (22, epp_row.suma_bonus),
                (23, epp_row.suma_bonus_reducere),
            ];
            for (col, val) in nums5 {
                sheet
                    .write_with_format(r, col, val, &data_fmt)
                    .map_err(|e| format!("Write error: {e}"))?;
            }

            // Total bonus — format as percentage string (e.g. "7%", "10%")
            sheet
                .write_with_format(r, 24, format!("{:.0}%", epp_row.total_bonus).as_str(), &data_fmt)
                .map_err(|e| format!("Write error: {e}"))?;

            // Suma voucher — format as RON with 2 decimals (e.g. "RON 1,234.56")
            // Use the same {:.2} format; Excel will display it as a string
            sheet
                .write_with_format(
                    r,
                    25,
                    format!("{:.2} RON", epp_row.suma_voucher).as_str(),
                    &data_fmt,
                )
                .map_err(|e| format!("Write error: {e}"))?;
        }

        sheet.autofit();
    }

    // Open native save dialog
    let default_filename = format!("EPro_All_Agents_{}.xlsx", year);
    let path = app
        .dialog()
        .file()
        .add_filter("Excel Spreadsheet", &["xlsx"])
        .set_file_name(&default_filename)
        .blocking_save_file()
        .ok_or("Export cancelled")?;

    let path_str = path.to_string();

    workbook
        .save(&path_str)
        .map_err(|e| format!("Save error: {e}"))?;

    Ok(path_str)
}

/// Build a valid Excel sheet name from an agent name.
///
/// Excel sheet names are limited to 31 characters and cannot contain
/// `[ ] : * ? / \`.  If the cleaned name collides with a previously-used
/// name, a numeric suffix is appended (e.g. `"Name"`, `"Name 2"`, `"Name 3"`).
fn make_sheet_name(
    agent_name: &str,
    used: &mut HashMap<String, usize>,
) -> String {
    // Remove invalid Excel characters
    let invalid_chars = ['[', ']', ':', '*', '?', '/', '\\'];
    let cleaned: String = agent_name
        .chars()
        .filter(|c| !invalid_chars.contains(c))
        .collect();

    // Truncate to 31 chars
    let mut candidate: String = cleaned.chars().take(31).collect();
    if candidate.is_empty() {
        candidate = "Agent".to_string();
    }

    // Handle collisions
    let count = used.entry(candidate.clone()).or_insert(0);
    if *count > 0 {
        *count += 1;
        // Try "Name 2", "Name 3", ..., truncating to fit within 31 chars
        let suffix = format!(" {}", *count);
        let max_base = 31 - suffix.len();
        let base: String = agent_name
            .chars()
            .filter(|c| !invalid_chars.contains(c))
            .take(max_base)
            .collect();
        candidate = format!("{}{}", base, suffix);
        // Guard against edge case where even the base is empty
        if candidate.is_empty() {
            candidate = format!("Agent{}", suffix);
        }
    } else {
        *count += 1;
    }

    candidate
}
