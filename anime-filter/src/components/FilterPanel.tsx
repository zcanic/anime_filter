import { useAnimeStore } from '../store/animeStore';
import { AnimeStatus } from '../types/anime';
import { X, Check, Bookmark, EyeOff, RotateCcw } from 'lucide-react';
import StatsPanel from './StatsPanel';

const STATUS_OPTIONS: { value: AnimeStatus | 'all'; label: string; icon: any }[] = [
  { value: 'all', label: '全部', icon: null },
  { value: 'unmarked', label: '未标记', icon: null },
  { value: 'watched', label: '已看', icon: Check },
  { value: 'wishlist', label: '想看', icon: Bookmark },
  { value: 'skipped', label: '跳过', icon: X },
];

const POPULAR_TAGS = [
  'TV', '剧场版', 'OVA', '日本', '原创', '漫画改', '小说改',
  '搞笑', '奇幻', '战斗', '日常', '恋爱', '科幻', '治愈',
  '校园', '后宫', '机战', '悬疑', '百合', '音乐'
];

export default function FilterPanel() {
  const { filterOptions, setFilterOptions } = useAnimeStore();

  // 简单的重置功能
  const handleReset = () => {
    setFilterOptions({
      yearRange: [2011, 2025],
      ratingRange: [0, 10],
      tags: [],
      status: 'all',
      searchQuery: ''
    });
  };

  const toggleTag = (tag: string) => {
    const currentTags = filterOptions.tags || [];
    if (currentTags.includes(tag)) {
      setFilterOptions({ tags: currentTags.filter(t => t !== tag) });
    } else {
      setFilterOptions({ tags: [...currentTags, tag] });
    }
  };

  return (
    <div className="h-full flex flex-col gap-6 p-2 text-sm">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-200">筛选条件</h2>
        <button
          onClick={handleReset}
          className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
          title="重置所有筛选"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* 状态筛选 */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-500 uppercase">状态</label>
        <div className="grid grid-cols-2 gap-2">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilterOptions({ status: opt.value })}
              className={`flex items-center gap-2 px-3 py-2 rounded-md border transition-all ${
                filterOptions.status === opt.value
                  ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                  : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-800 hover:border-gray-600'
              }`}
            >
              {opt.icon && <opt.icon size={14} />}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 年份筛选 */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-500 uppercase">年份范围 (2011-2025)</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={2011}
            max={2025}
            value={filterOptions.yearRange[0]}
            onChange={(e) => setFilterOptions({ yearRange: [parseInt(e.target.value), filterOptions.yearRange[1]] })}
            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-center"
          />
          <span className="text-gray-600">-</span>
          <input
            type="number"
            min={2011}
            max={2025}
            value={filterOptions.yearRange[1]}
            onChange={(e) => setFilterOptions({ yearRange: [filterOptions.yearRange[0], parseInt(e.target.value)] })}
            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-center"
          />
        </div>
      </div>

      {/* 评分筛选 */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-500 uppercase">最低评分</label>
        <div className="flex items-center gap-3">
            <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={filterOptions.ratingRange[0]}
                onChange={(e) => setFilterOptions({ ratingRange: [parseFloat(e.target.value), 10] })}
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="w-8 text-right font-mono text-blue-400">{filterOptions.ratingRange[0]}</span>
        </div>
      </div>

      {/* 标签筛选 */}
      <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
        <label className="text-xs font-medium text-gray-500 uppercase">热门标签</label>
        <div className="flex-1 overflow-y-auto pr-1">
            <div className="flex flex-wrap gap-2">
            {POPULAR_TAGS.map(tag => {
                const isSelected = filterOptions.tags?.includes(tag);
                return (
                <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    isSelected
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                >
                    {tag}
                </button>
                );
            })}
            </div>
        </div>
      </div>

      <div className="border-t border-gray-800 pt-4">
        <StatsPanel />
      </div>
    </div>
  );
}
