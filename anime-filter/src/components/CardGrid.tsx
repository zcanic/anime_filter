import { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Anime, AnimeStatus } from '../types/anime';
import AnimeCard from './AnimeCard';

interface CardGridProps {
  animeList: Anime[];
  viewMode: 'large' | 'medium' | 'small';
  userStatusMap: Map<number, AnimeStatus>;
  userRatingMap: Map<number, number>;
  onMark: (id: number, status: AnimeStatus) => void;
  onOpenDetail: (anime: Anime) => void;
}

const CardGrid = ({ animeList, viewMode, userStatusMap, userRatingMap, onMark, onOpenDetail }: CardGridProps) => {
  const parentRef = useRef<HTMLDivElement>(null);

  // 根据视图模式计算列数
  const getColumns = () => {
    switch (viewMode) {
      case 'small': return 4;
      case 'medium': return 3;
      case 'large': return 2;
      default: return 3;
    }
  };

  const columns = getColumns();
  const count = Math.ceil(animeList.length / columns);

  const rowVirtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => viewMode === 'small' ? 100 : viewMode === 'medium' ? 140 : 180,
    overscan: 5,
  });

  // 当列数变化时，强制重新计算
  useEffect(() => {
    rowVirtualizer.measure();
  }, [columns, rowVirtualizer]);

  return (
    <div
      ref={parentRef}
      className="h-full w-full overflow-y-auto pr-2"
      style={{ contain: 'strict' }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const rowStartIndex = virtualRow.index * columns;
          const rowItems = animeList.slice(rowStartIndex, rowStartIndex + columns);

          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className={`grid gap-4 px-2 ${
                viewMode === 'small' ? 'grid-cols-4' :
                viewMode === 'medium' ? 'grid-cols-3' : 'grid-cols-2'
              }`}
            >
              {rowItems.map((anime) => (
                <AnimeCard
                  key={anime.subject_id}
                  anime={anime}
                  status={userStatusMap.get(anime.subject_id) || 'unmarked'}
                  userRating={userRatingMap.get(anime.subject_id)}
                  viewMode={viewMode}
                  onMark={onMark}
                  onOpenDetail={onOpenDetail}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CardGrid;
