use crate::database::Database;
use crate::models::{Anime, AnimeStats, UserAnimeData};
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    pub anime_data: Mutex<Vec<Anime>>,
    pub db: Mutex<Database>,
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
