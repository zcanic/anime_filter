import type { Anime, FilterOptions } from '../types/anime';

// 解析标签字符串为数组
export function parseTags(tagsStr: string | null): string[] {
  if (!tagsStr) return [];
  try {
    // 假设标签以某种分隔符分隔，需要根据实际数据调整
    return tagsStr.split(/[,;、]/).map((tag) => tag.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// 解析完成率字符串为数字
export function parseCompletionRate(rate: string | null): number {
  if (!rate) return 0;
  const match = rate.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

// 根据过滤条件过滤番剧
export function filterAnime(anime: Anime[], filters: FilterOptions, userStatusMap: Map<number, string>): Anime[] {
  return anime.filter((item) => {
    // 年份过滤
    if (item.year < filters.yearRange[0] || item.year > filters.yearRange[1]) {
      return false;
    }

    // 评分过滤
    if (item.平均分 !== null) {
      if (item.平均分 < filters.ratingRange[0] || item.平均分 > filters.ratingRange[1]) {
        return false;
      }
    }

    // 标签过滤
    if (filters.tags.length > 0) {
      const itemTags = parseTags(item.tags);
      const hasTag = filters.tags.some((tag) =>
        itemTags.some((itemTag) => itemTag.toLowerCase().includes(tag.toLowerCase()))
      );
      if (!hasTag) return false;
    }

    // 状态过滤
    if (filters.status !== 'all') {
      const userStatus = userStatusMap.get(item.subject_id);
      if (filters.status === 'unmarked') {
        if (userStatus) return false;
      } else {
        if (userStatus !== filters.status) return false;
      }
    }

    // 收藏数过滤
    if (filters.minCollections && item.收藏 !== null) {
      if (item.收藏 < filters.minCollections) return false;
    }

    // 搜索关键词
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const titleMatch = item.title.toLowerCase().includes(query);
      const suppTitleMatch = item.supp_title?.toLowerCase().includes(query);
      if (!titleMatch && !suppTitleMatch) return false;
    }

    return true;
  });
}

// 提取所有唯一标签
export function extractUniqueTags(anime: Anime[]): string[] {
  const tagsSet = new Set<string>();
  anime.forEach((item) => {
    const tags = parseTags(item.tags);
    tags.forEach((tag) => tagsSet.add(tag));
  });
  return Array.from(tagsSet).sort();
}

// 格式化大数字（如收藏数）
export function formatNumber(num: number | null): string {
  if (num === null) return '-';
  if (num >= 10000) return `${(num / 10000).toFixed(1)}万`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
}
