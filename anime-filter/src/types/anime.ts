// 番剧数据类型定义
export interface Anime {
  url: string;
  subject_id: number;
  title: string;
  img_url: string | null;
  year: number;
  supp_title: string | null;
  year_supp: number | null;
  收藏: number | null;
  看过: number | null;
  完成率: string | null;
  力荐: number | null;
  标准差: number | null;
  评分数: number | null;
  平均分: number | null;
  has_supp: boolean;
  infobox_raw: string | null;
  tags: string | null;
  character_count: number | null;
  va_count: number | null;
  all_characters: string | null;
  all_vas: string | null;
  characters_json: string | null;
}

// 用户标记状态
export type AnimeStatus = 'watched' | 'wishlist' | 'skipped' | 'unmarked';

// 用户标记数据
export interface UserAnimeData {
  subject_id: number;
  status: AnimeStatus;
  rating?: number; // 1-10
  tags?: string[];
  marked_at: string;
}

// 过滤器选项
export interface FilterOptions {
  yearRange: [number, number];
  ratingRange: [number, number];
  tags: string[];
  status: AnimeStatus | 'all';
  minCollections?: number;
  searchQuery?: string;
}

// 视图模式
export type ViewMode = 'large' | 'medium' | 'small';

// 卡片动画方向
export type SwipeDirection = 'left' | 'right' | 'down';

// 统计数据
export interface AnimeStats {
  totalWatched: number;
  totalWishlist: number;
  totalSkipped: number;
  totalUnmarked: number;
  averageRating: number;
  topTags: Array<{ tag: string; count: number }>;
  yearDistribution: Array<{ year: number; count: number }>;
}
