//! Tauri Commands - Pure HTTP Forwarding Layer
//!
//! These commands act as a transparent bridge between frontend and Python backend.
//! NO business logic here - all logic lives in Python.
//!
//! Pattern:
//! 1. Frontend calls `invoke("command_name", { params })`
//! 2. Rust reads backend port from AppState
//! 3. Rust forwards request via HTTP to Python
//! 4. Response is returned to frontend as-is

use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

// ============================================================================
// Minimal Types for Serialization (just for JSON structure)
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct UserAction {
    pub subject_id: i64,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
}

// ============================================================================
// Status Commands
// ============================================================================

/// Get the current backend port (for debugging)
#[tauri::command]
pub fn get_backend_port(state: State<'_, Arc<AppState>>) -> Result<u16, String> {
    let port = state.get_backend_port();
    if port == 0 {
        Err("Backend not yet initialized".to_string())
    } else {
        Ok(port)
    }
}

/// Forward health check to Python backend
#[tauri::command]
pub async fn forward_health_check(state: State<'_, Arc<AppState>>) -> Result<serde_json::Value, String> {
    state.ensure_ready()?;
    state.get_json("/health").await
}

// ============================================================================
// Anime Commands (All forwarded to Python)
// ============================================================================

/// Get anime list with optional filters
#[tauri::command]
pub async fn forward_get_anime_list(
    state: State<'_, Arc<AppState>>,
    limit: Option<i32>,
    offset: Option<i32>,
    tags: Option<Vec<String>>,
    min_rating: Option<f64>,
    year_start: Option<i32>,
    year_end: Option<i32>,
    status_filter: Option<String>,
) -> Result<serde_json::Value, String> {
    state.ensure_ready()?;

    let mut params = vec![
        format!("limit={}", limit.unwrap_or(100)),
        format!("offset={}", offset.unwrap_or(0)),
    ];

    if let Some(t) = tags {
        for tag in t {
            params.push(format!("tags={}", tag));
        }
    }
    if let Some(r) = min_rating {
        params.push(format!("min_rating={}", r));
    }
    if let Some(y) = year_start {
        params.push(format!("year_start={}", y));
    }
    if let Some(y) = year_end {
        params.push(format!("year_end={}", y));
    }
    if let Some(s) = status_filter {
        params.push(format!("status_filter={}", s));
    }

    let url = format!("/api/anime/list?{}", params.join("&"));
    state.get_json(&url).await
}

/// Mark a single anime
#[tauri::command]
pub async fn forward_mark_anime(
    state: State<'_, Arc<AppState>>,
    subject_id: i64,
    status: String,
    rating: Option<i32>,
) -> Result<serde_json::Value, String> {
    state.ensure_ready()?;

    let body = serde_json::json!({
        "subject_id": subject_id,
        "status": status,
        "rating": rating,
    });

    state.post_json("/api/anime/mark", &body).await
}

/// Save user action logs
#[tauri::command]
pub async fn forward_save_user_logs(
    state: State<'_, Arc<AppState>>,
    actions: Vec<UserAction>,
) -> Result<serde_json::Value, String> {
    state.ensure_ready()?;
    state.post_json("/api/anime/user-logs", &actions).await
}

/// Load all user logs
#[tauri::command]
pub async fn forward_load_user_logs(
    state: State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    state.ensure_ready()?;
    state.get_json("/api/anime/user-logs").await
}

/// Delete a specific user log
#[tauri::command]
pub async fn forward_delete_user_log(
    state: State<'_, Arc<AppState>>,
    subject_id: i64,
) -> Result<serde_json::Value, String> {
    state.ensure_ready()?;
    state.delete_json(&format!("/api/anime/user-logs/{}", subject_id)).await
}

/// Clear all user logs
#[tauri::command]
pub async fn forward_clear_all_logs(
    state: State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    state.ensure_ready()?;
    state.delete_json("/api/anime/user-logs").await
}

/// Get statistics
#[tauri::command]
pub async fn forward_get_stats(
    state: State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    state.ensure_ready()?;
    state.get_json("/api/anime/stats").await
}

// ============================================================================
// AI Commands (Forwarded to Python)
// ============================================================================

/// Get AI recommendations
#[tauri::command]
pub async fn forward_get_recommendations(
    state: State<'_, Arc<AppState>>,
    watched_ids: Vec<i64>,
    liked_ids: Vec<i64>,
    disliked_ids: Vec<i64>,
    limit: Option<i32>,
) -> Result<serde_json::Value, String> {
    state.ensure_ready()?;

    let body = serde_json::json!({
        "watched_ids": watched_ids,
        "liked_ids": liked_ids,
        "disliked_ids": disliked_ids,
        "limit": limit.unwrap_or(10),
    });

    state.post_json("/api/ai/recommend", &body).await
}
