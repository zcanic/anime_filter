// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod csv_parser;
mod database;
mod models;

use commands::{AppState, batch_mark_anime, get_all_anime, get_all_user_status, get_stats, get_user_status, mark_anime};
use csv_parser::load_anime_from_csv;
use database::Database;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // 获取应用数据目录
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            // 确保目录存在
            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");

            // 数据库路径
            let db_path = app_data_dir.join("anime_filter.db");
            println!("Database path: {:?}", db_path);

            // 初始化数据库
            let db = Database::new(&db_path).expect("Failed to initialize database");

            // CSV 文件路径 - 使用绝对路径
            let csv_path = PathBuf::from("/Users/zcan/Documents/sthtry/anime_csv/full_data.csv");

            // 加载番剧数据
            println!("Loading anime data from CSV...");
            let anime_data = load_anime_from_csv(&csv_path)
                .expect("Failed to load anime data from CSV");
            println!("Successfully loaded {} anime records", anime_data.len());

            // 创建应用状态
            let state = AppState {
                anime_data: Mutex::new(anime_data),
                db: Mutex::new(db),
            };

            app.manage(state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_all_anime,
            mark_anime,
            batch_mark_anime,
            get_user_status,
            get_all_user_status,
            get_stats
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
