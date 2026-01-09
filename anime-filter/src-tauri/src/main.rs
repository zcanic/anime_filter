//! AnimePick - Tauri Desktop Application Entry Point
//!
//! Architecture: Rust Gateway + Python Sidecar
//! - Rust: Window management, Python lifecycle, HTTP forwarding
//! - Python: ALL business logic (database, AI, filtering)

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod sidecar;
mod state;

use crate::sidecar::SidecarManager;
use crate::state::AppState;
use commands::{
    forward_clear_all_logs, forward_delete_user_log, forward_get_anime_list,
    forward_get_recommendations, forward_get_stats, forward_health_check,
    forward_load_user_logs, forward_mark_anime, forward_save_user_logs,
    get_backend_port,
};
use std::sync::Arc;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| {
                    eprintln!("[Tauri] Failed to get app data directory: {}", e);
                    e
                })?;

            std::fs::create_dir_all(&app_data_dir).map_err(|e| {
                eprintln!("[Tauri] Failed to create app data directory: {}", e);
                e
            })?;

            println!("[Tauri] App data dir: {:?}", app_data_dir);

            // Lightweight state - no database, no data loading
            let app_state = Arc::new(AppState::new(app_data_dir.clone()).map_err(|e| {
                eprintln!("[Tauri] Failed to create app state: {}", e);
                e
            })?);
            app.manage(app_state.clone());

            // Set env var so Python knows where to store data
            std::env::set_var("ANIMEPICK_APP_DATA_DIR", &app_data_dir);

            // Spawn Python sidecar
            let state_clone = app_state.clone();
            let app_handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                match SidecarManager::spawn_python_backend(&app_handle).await {
                    Ok(port) => {
                        state_clone.set_backend_port(port);
                        
                        // Verify connection
                        match state_clone.health_check().await {
                            Ok(_) => println!("[Tauri] ✓ Backend connected"),
                            Err(e) => eprintln!("[Tauri] ✗ Health check failed: {}", e),
                        }
                    }
                    Err(e) => eprintln!("[Tauri] ✗ Failed to start backend: {}", e),
                }
            });

            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                println!("[Tauri] Shutting down...");
                SidecarManager::kill_python_backend();
            }
        })
        .invoke_handler(tauri::generate_handler![
            // Status
            get_backend_port,
            forward_health_check,
            // Anime (forwarded to Python)
            forward_get_anime_list,
            forward_mark_anime,
            forward_save_user_logs,
            forward_load_user_logs,
            forward_delete_user_log,
            forward_clear_all_logs,
            forward_get_stats,
            // AI (forwarded to Python)
            forward_get_recommendations,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("[Tauri] Failed to run Tauri application: {}", e);
            std::process::exit(1);
        });
}
