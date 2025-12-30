import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Anime, UserAnimeData, AnimeStatus, FilterOptions, ViewMode } from '../types/anime';

interface AnimeStore {
  // 数据
  allAnime: Anime[];
  filteredAnime: Anime[];
  userDataMap: Map<number, UserAnimeData>;

  // UI 状态
  viewMode: ViewMode;
  filterOptions: FilterOptions;
  isLoading: boolean;

  // 操作
  setAllAnime: (anime: Anime[]) => void;
  setFilteredAnime: (anime: Anime[]) => void;
  markAnime: (subjectId: number, status: AnimeStatus, rating?: number) => void;
  batchMarkAnime: (subjectIds: number[], status: AnimeStatus) => void;
  setViewMode: (mode: ViewMode) => void;
  setFilterOptions: (options: Partial<FilterOptions>) => void;
  setIsLoading: (loading: boolean) => void;
  getUserStatus: (subjectId: number) => AnimeStatus;
}

export const useAnimeStore = create<AnimeStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      allAnime: [],
      filteredAnime: [],
      userDataMap: new Map(),
      viewMode: 'medium',
      filterOptions: {
        yearRange: [2011, 2025],
        ratingRange: [0, 10],
        tags: [],
        status: 'all',
        searchQuery: '',
      },
      isLoading: false,

      // 设置所有番剧数据
      setAllAnime: (anime) => set({ allAnime: anime, filteredAnime: anime }),

      // 设置过滤后的数据
      setFilteredAnime: (anime) => set({ filteredAnime: anime }),

      // 标记单个番剧
      markAnime: (subjectId, status, rating) => {
        const { userDataMap } = get();
        const newMap = new Map(userDataMap);
        newMap.set(subjectId, {
          subject_id: subjectId,
          status,
          rating,
          marked_at: new Date().toISOString(),
        });
        set({ userDataMap: newMap });
      },

      // 批量标记番剧
      batchMarkAnime: (subjectIds, status) => {
        const { userDataMap } = get();
        const newMap = new Map(userDataMap);
        const now = new Date().toISOString();

        subjectIds.forEach((id) => {
          newMap.set(id, {
            subject_id: id,
            status,
            marked_at: now,
          });
        });

        set({ userDataMap: newMap });
      },

      // 设置视图模式
      setViewMode: (mode) => set({ viewMode: mode }),

      // 设置过滤选项
      setFilterOptions: (options) =>
        set((state) => ({
          filterOptions: { ...state.filterOptions, ...options },
        })),

      // 设置加载状态
      setIsLoading: (loading) => set({ isLoading: loading }),

      // 获取番剧的用户状态
      getUserStatus: (subjectId) => {
        const { userDataMap } = get();
        return userDataMap.get(subjectId)?.status || 'unmarked';
      },
    }),
    {
      name: 'anime-filter-storage',
      partialize: (state) => ({
        userDataMap: Array.from(state.userDataMap.entries()),
        viewMode: state.viewMode,
        filterOptions: state.filterOptions,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.userDataMap)) {
          state.userDataMap = new Map(state.userDataMap as any);
        }
      },
    }
  )
);
