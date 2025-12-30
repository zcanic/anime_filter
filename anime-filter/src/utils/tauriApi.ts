import { invoke } from '@tauri-apps/api/core';
import type { Anime, UserAnimeData, AnimeStats, AnimeStatus } from '../types/anime';

export async function getAllAnime(): Promise<Anime[]> {
  return await invoke('get_all_anime');
}

export async function markAnime(
  subjectId: number,
  status: AnimeStatus,
  rating?: number
): Promise<void> {
  return await invoke('mark_anime', { subjectId, status, rating });
}

export async function batchMarkAnime(
  subjectIds: number[],
  status: AnimeStatus
): Promise<void> {
  return await invoke('batch_mark_anime', { subjectIds, status });
}

export async function getUserStatus(subjectId: number): Promise<UserAnimeData | null> {
  return await invoke('get_user_status', { subjectId });
}

export async function getAllUserStatus(): Promise<UserAnimeData[]> {
  return await invoke('get_all_user_status');
}

export async function getStats(): Promise<AnimeStats> {
  return await invoke('get_stats');
}
