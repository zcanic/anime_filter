use crate::database::Database;
use crate::models::{Anime, AnimeStats, UserAnimeData};
use std::sync::Mutex;
use tauri::State;
use std::fs::{OpenOptions, File};
use std::path::PathBuf;
use std::io::{Write, BufReader}; // BufReader unused but keeping for safety if implicit

pub struct AppState {
    pub anime_data: Mutex<Vec<Anime>>,
    pub db: Mutex<Database>,
    pub csv_log_path: PathBuf,
    pub csv_lock: Mutex<()>,
}

#[tauri::command]
pub fn get_all_anime(state: State<'_, AppState>) -> Result<Vec<Anime>, String> {
    let anime_data = state.anime_data.lock().map_err(|e| e.to_string())?;
    Ok(anime_data.clone())
}

#[tauri::command]
pub fn mark_anime(
    state: State<'_, AppState>,
    subject_id: i64,
    status: String,
    rating: Option<i32>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let user_data = UserAnimeData {
        subject_id,
        status,
        rating,
        tags: None,
        marked_at: chrono::Utc::now().to_rfc3339(),
    };

    db.save_user_status(&user_data)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn batch_mark_anime(
    state: State<'_, AppState>,
    subject_ids: Vec<i64>,
    status: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    let data_list: Vec<UserAnimeData> = subject_ids
        .into_iter()
        .map(|id| UserAnimeData {
            subject_id: id,
            status: status.clone(),
            rating: None,
            tags: None,
            marked_at: now.clone(),
        })
        .collect();

    db.batch_save_user_status(&data_list)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_user_status(state: State<'_, AppState>, subject_id: i64) -> Result<Option<UserAnimeData>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_user_status(subject_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_all_user_status(state: State<'_, AppState>) -> Result<Vec<UserAnimeData>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_all_user_status().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_stats(state: State<'_, AppState>) -> Result<AnimeStats, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let all_status = db.get_all_user_status().map_err(|e| e.to_string())?;
    let anime_data = state.anime_data.lock().map_err(|e| e.to_string())?;

    let total = anime_data.len() as i32;
    let total_watched = all_status.iter().filter(|s| s.status == "watched").count() as i32;
    let total_wishlist = all_status.iter().filter(|s| s.status == "wishlist").count() as i32;
    let total_skipped = all_status.iter().filter(|s| s.status == "skipped").count() as i32;
    let total_unmarked = total - total_watched - total_wishlist - total_skipped;

    Ok(AnimeStats {
        total_watched,
        total_wishlist,
        total_skipped,
        total_unmarked,
    })
}

#[derive(serde::Deserialize)]
pub struct SimpleUserAction {
    pub subject_id: i64,
    pub status: String, // "watched", "interested", "skipped"
    pub timestamp: String,
}

#[tauri::command]
pub fn save_user_log_csv(
    state: State<'_, AppState>,
    actions: Vec<SimpleUserAction>,
) -> Result<(), String> {
    let _lock = state.csv_lock.lock().map_err(|e| e.to_string())?; // Lock file access

    let path = &state.csv_log_path;
    let file_exists = path.exists();

    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|e| format!("Failed to open CSV file: {}", e))?;

    let mut wtr = csv::WriterBuilder::new()
        .has_headers(!file_exists)
        .from_writer(file);

    for action in actions {
        wtr.serialize((
            action.subject_id,
            &action.status,
            &action.timestamp,
        )).map_err(|e| format!("Failed to write CSV record: {}", e))?;
    }

    wtr.flush().map_err(|e| format!("Failed to flush CSV: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn load_user_log_csv(state: State<'_, AppState>) -> Result<Vec<UserAnimeData>, String> {
    let _lock = state.csv_lock.lock().map_err(|e| e.to_string())?; // Lock file access

    let path = &state.csv_log_path;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let file = File::open(path).map_err(|e| format!("Failed to open CSV file: {}", e))?;
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(true)
        .from_reader(file);

    let mut results = Vec::new();
    for result in rdr.records() {
        if let Ok(record) = result {
             // Expected format: id, status, timestamp
             if record.len() >= 3 {
                 let subject_id: i64 = record[0].parse().unwrap_or(0);
                 let status = record[1].to_string();
                 let marked_at = record[2].to_string();
                 
                 results.push(UserAnimeData {
                     subject_id,
                     status,
                     rating: None,
                     tags: None,
                     marked_at,
                 });
             }
        }
    }
    Ok(results)
}

#[tauri::command]
pub fn delete_user_log(
    state: State<'_, AppState>,
    subject_id: i64,
) -> Result<(), String> {
    let _lock = state.csv_lock.lock().map_err(|e| e.to_string())?; // Lock file access

    let path = &state.csv_log_path;
    if !path.exists() {
        return Ok(());
    }

    // 1. Read all records
    let file = File::open(path).map_err(|e| format!("Failed to open CSV for reading: {}", e))?;
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(true)
        .from_reader(file);

    let mut all_records = Vec::new();
    for result in rdr.records() {
        let record = result.map_err(|e| format!("Failed to read record: {}", e))?;
        all_records.push(record);
    }

    // 2. Find the *last* record matching subject_id
    let mut index_to_remove = None;
    for (i, record) in all_records.iter().enumerate().rev() {
        if record.len() >= 1 {
            let record_id: i64 = record[0].parse().unwrap_or(0);
            if record_id == subject_id {
                index_to_remove = Some(i);
                break;
            }
        }
    }

    // 3. Remove if found
    if let Some(index) = index_to_remove {
        all_records.remove(index);
    }

    // 4. Write back
    let file = OpenOptions::new()
        .write(true)
        .truncate(true)
        .open(path)
        .map_err(|e| format!("Failed to open CSV for writing: {}", e))?;

    let mut wtr = csv::WriterBuilder::new()
        .has_headers(true)
        .from_writer(file);
    
    wtr.write_record(&["subject_id", "status", "timestamp"])
        .map_err(|e| format!("Failed to write header: {}", e))?;

    for record in all_records {
        wtr.write_record(&record)
            .map_err(|e| format!("Failed to write record: {}", e))?;
    }

    wtr.flush().map_err(|e| format!("Failed to flush CSV: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn clear_all_user_logs(state: State<'_, AppState>) -> Result<(), String> {
    let _lock = state.csv_lock.lock().map_err(|e| e.to_string())?; // Lock file access

    let path = &state.csv_log_path;
    
    // Open in truncate mode to clear file
    let file = OpenOptions::new()
        .write(true)
        .truncate(true)
        .create(true)
        .open(path)
        .map_err(|e| format!("Failed to open CSV for clearing: {}", e))?;

    let mut wtr = csv::WriterBuilder::new()
        .has_headers(true)
        .from_writer(file);

    // Just write the headers back
    wtr.write_record(&["subject_id", "status", "timestamp"])
        .map_err(|e| format!("Failed to write header: {}", e))?;
        
    wtr.flush().map_err(|e| format!("Failed to flush CSV: {}", e))?;
    Ok(())
}
