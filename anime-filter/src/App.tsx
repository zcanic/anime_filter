import { useEffect, useState, useMemo } from 'react';
import { getAllAnime, getAllUserStatus, markAnime } from './utils/tauriApi';
import { useAnimeStore } from './store/animeStore';
import CardGrid from './components/CardGrid';
import FilterPanel from './components/FilterPanel';
import { Anime, AnimeStatus } from './types/anime';
import { Search, SlidersHorizontal, LayoutGrid, RotateCw } from 'lucide-react';

function App() {
  const {
    allAnime,
    setAllAnime,
    userDataMap,
    markAnime: markStore,
    viewMode,
    setViewMode,
    filterOptions,
    setFilterOptions
  } = useAnimeStore();

  const [isLoading, setIsLoading] = useState(true);

  // 初始化加载数据
  useEffect(() => {
    async function initData() {
      try {
        setIsLoading(true);
        const [animeList, userStatusList] = await Promise.all([
          getAllAnime(),
          getAllUserStatus()
        ]);

        // 初始化 Store
        setAllAnime(animeList);

        // 同步后端状态到 Store
        if (userStatusList && userStatusList.length > 0) {
           // 这里我们简单起见，假设 Store 已经有逻辑处理这个初始化
           // 实际上可能需要扩展 store 来支持批量 setUserDataMap
           // 暂时先跳过这步，因为 store 的 persist 中间件可能会处理
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    initData();
  }, [setAllAnime]);

  // 处理过滤逻辑
  const filteredAnime = useMemo(() => {
    return allAnime.filter(anime => {
      // 1. 搜索过滤
      if (filterOptions.searchQuery) {
        const query = filterOptions.searchQuery.toLowerCase();
        const matchTitle = anime.title.toLowerCase().includes(query);
        const matchTags = anime.tags?.toLowerCase().includes(query);
        if (!matchTitle && !matchTags) return false;
      }

      // 2. 状态过滤
      if (filterOptions.status !== 'all') {
        const currentStatus = userDataMap.get(anime.subject_id)?.status || 'unmarked';
        if (filterOptions.status === 'unmarked') {
            if (currentStatus !== 'unmarked') return false;
        } else if (currentStatus !== filterOptions.status) {
            return false;
        }
      }

      // 3. 年份过滤
      if (anime.year < filterOptions.yearRange[0] || anime.year > filterOptions.yearRange[1]) {
        return false;
      }

      // 4. 评分过滤
      const score = anime.平均分 || 0;
      if (score < filterOptions.ratingRange[0] || score > filterOptions.ratingRange[1]) {
        return false;
      }

      return true;
    });
  }, [allAnime, filterOptions, userDataMap]);

  // 处理标记
  const handleMark = async (id: number, status: AnimeStatus) => {
    // 乐观更新 Store
    markStore(id, status);
    // 异步更新后端
    await markAnime(id, status);
  };

  // 生成状态 Map 和 评分 Map 供 Grid 使用
  const userStatusMap = useMemo(() => {
    const map = new Map<number, AnimeStatus>();
    userDataMap.forEach((v, k) => map.set(k, v.status));
    return map;
  }, [userDataMap]);

  const userRatingMap = useMemo(() => {
    const map = new Map<number, number>();
    userDataMap.forEach((v, k) => {
        if (v.rating) map.set(k, v.rating);
    });
    return map;
  }, [userDataMap]);


  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <RotateCw className="animate-spin text-blue-500" size={48} />
          <p className="text-xl font-light">正在加载 14,000+ 部番剧...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      {/* 顶部栏 */}
      <header className="h-16 border-b border-gray-800 flex items-center px-6 gap-6 shrink-0 bg-gray-900/50 backdrop-blur">
        <div className="font-bold text-xl tracking-tight bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Anime Filter
        </div>

        {/* 搜索框 */}
        <div className="flex-1 max-w-xl relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={18} />
          <input
            type="text"
            placeholder="搜索番剧、标签..."
            className="w-full bg-gray-900 border border-gray-700 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            value={filterOptions.searchQuery || ''}
            onChange={(e) => setFilterOptions({ searchQuery: e.target.value })}
          />
        </div>

        {/* 视图切换 */}
        <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1 border border-gray-700">
          {(['small', 'medium', 'large'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === mode ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
              }`}
              title={mode}
            >
              <LayoutGrid size={16} />
            </button>
          ))}
        </div>

        {/* 统计信息 */}
        <div className="text-sm text-gray-400">
          已筛选: <span className="text-white font-medium">{filteredAnime.length}</span> / {allAnime.length}
        </div>
      </header>

      {/* 主体区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：过滤器 */}
        <aside className="w-64 border-r border-gray-800 p-4 bg-gray-900/30">
           <FilterPanel />
        </aside>

        {/* 右侧：网格 */}
        <main className="flex-1 p-4 relative">
          <CardGrid
            animeList={filteredAnime}
            viewMode={viewMode}
            userStatusMap={userStatusMap}
            userRatingMap={userRatingMap}
            onMark={handleMark}
            onOpenDetail={(anime) => console.log('Open detail', anime)}
          />
        </main>
      </div>

      {/* 底部状态栏 */}
      <footer className="h-8 border-t border-gray-800 bg-gray-900 px-4 flex items-center justify-between text-xs text-gray-500">
        <div>快捷键: J (已看) / K (跳过) / L (想看)</div>
        <div>v0.1.0</div>
      </footer>
    </div>
  );
}

export default App;
