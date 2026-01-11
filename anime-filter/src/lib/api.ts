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

export async function saveUserLogs(actions: SimpleUserAction[], sessionId?: string) {
  try {
    await invoke("forward_save_user_logs", {
      actions,
      session_id: sessionId
    });
  } catch (error) {
    console.error("Failed to save user logs:", error);
  }
}

export async function loadUserLogs(): Promise<UserAnimeData[]> {
  try {
    const result = await invoke("forward_load_user_logs");
    return (result as any).data || [];
  } catch (error) {
    console.error("Failed to load user logs:", error);
    return [];
  }
}

export async function deleteUserLog(subject_id: number): Promise<void> {
  try {
    await invoke("forward_delete_user_log", { subject_id });
  } catch (error) {
    console.error("Failed to delete user log:", error);
  }
}

export async function clearAllUserLogs(): Promise<void> {
  try {
    await invoke("forward_clear_all_logs");
  } catch (error) {
    console.error("Failed to clear all user logs:", error);
  }
}

/**
 * Fetch recommended anime IDs from the backend
 * @param sessionId - User session ID
 * @param statusFilter - Optional status filter (all/watched/unwatched/interested/skipped)
 * @param limit - Maximum number of recommendations to return
 * @returns Object containing filtered_ids array and session_id
 */
export async function fetchRecommendedAnime(
  sessionId: string,
  statusFilter?: string,
  limit?: number
): Promise<{ filtered_ids: number[]; session_id: string; count: number }> {
  try {
    const result = await invoke("forward_get_anime_list", {
      sort_by: "recommended",
      session_id: sessionId,
      status_filter: statusFilter || "all",
      limit: limit || 10000,
    });
    return result as { filtered_ids: number[]; session_id: string; count: number };
  } catch (error) {
    console.error("Failed to fetch recommended anime:", error);
    return { filtered_ids: [], session_id: sessionId, count: 0 };
  }
}
