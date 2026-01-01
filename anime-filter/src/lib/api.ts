import { invoke } from "@tauri-apps/api/core";

export interface SimpleUserAction {
  subject_id: number;
  status: string; // "watched", "interested", "skipped"
  timestamp: string;
}

export interface UserAnimeData {
  subject_id: number;
  status: string;
  rating?: number;
  tags?: string;
  marked_at: string;
}

export async function saveUserLogs(actions: SimpleUserAction[]) {
  try {
    await invoke("save_user_log_csv", { actions });
  } catch (error) {
    console.error("Failed to save user logs:", error);
  }
}

export async function loadUserLogs(): Promise<UserAnimeData[]> {
  try {
    return await invoke("load_user_log_csv");
  } catch (error) {
    console.error("Failed to load user logs:", error);
    return [];
  }
}

export async function deleteUserLog(subject_id: number): Promise<void> {
  try {
    await invoke("delete_user_log", { subject_id: subject_id });
  } catch (error) {
    console.error("Failed to delete user log:", error);
  }
}

export async function clearAllUserLogs(): Promise<void> {
  try {
    await invoke("clear_all_user_logs");
  } catch (error) {
    console.error("Failed to clear all user logs:", error);
  }
}
