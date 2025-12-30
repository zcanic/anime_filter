import { useMemo } from 'react';
import { useAnimeStore } from '../store/animeStore';

export default function StatsPanel() {
  const { allAnime, userDataMap } = useAnimeStore();

  const stats = useMemo(() => {
    let watched = 0;
    let wishlist = 0;
    let skipped = 0;

    userDataMap.forEach((data) => {
      if (data.status === 'watched') watched++;
      else if (data.status === 'wishlist') wishlist++;
      else if (data.status === 'skipped') skipped++;
    });

    const total = allAnime.length || 1; // avoid division by zero
    const marked = watched + wishlist + skipped;
    const unmarked = total - marked;

    return {
      watched,
      wishlist,
      skipped,
      unmarked,
      total,
      progress: Math.round((marked / total) * 100)
    };
  }, [userDataMap, allAnime.length]);

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
      <h3 className="text-sm font-medium text-gray-300 mb-3">标记进度</h3>

      {/* 进度条 */}
      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden mb-1">
        <div
          className="h-full bg-blue-500 transition-all duration-500 ease-out"
          style={{ width: `${stats.progress}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mb-4">
        <span>{stats.progress}% 完成</span>
        <span>{stats.watched + stats.wishlist + stats.skipped} / {stats.total}</span>
      </div>

      {/* 详细统计 */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2 p-2 rounded bg-green-500/10 border border-green-500/20 text-green-400">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>已看: {stats.watched}</span>
        </div>
        <div className="flex items-center gap-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span>想看: {stats.wishlist}</span>
        </div>
        <div className="flex items-center gap-2 p-2 rounded bg-gray-500/10 border border-gray-500/20 text-gray-400">
          <div className="w-2 h-2 rounded-full bg-gray-500" />
          <span>跳过: {stats.skipped}</span>
        </div>
      </div>
    </div>
  );
}
