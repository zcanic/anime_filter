import { Anime, AnimeStatus } from '../types/anime';
import { motion } from 'framer-motion';
import { Star, Check, X, Bookmark, ExternalLink } from 'lucide-react';
import { memo } from 'react';

interface AnimeCardProps {
  anime: Anime;
  status: AnimeStatus;
  userRating?: number;
  viewMode: 'large' | 'medium' | 'small';
  onMark: (id: number, status: AnimeStatus) => void;
  onOpenDetail: (anime: Anime) => void;
}

const statusColors = {
  watched: 'bg-green-500/20 border-green-500/50',
  wishlist: 'bg-yellow-500/20 border-yellow-500/50',
  skipped: 'bg-gray-500/20 border-gray-500/50',
  unmarked: 'bg-white/5 border-white/10 hover:border-white/30',
};

const AnimeCard = memo(({ anime, status, userRating, viewMode, onMark, onOpenDetail }: AnimeCardProps) => {
  // 处理图片 URL - 如果是 http 开头，尝试加载，或者显示占位符
  // 注意：实际项目中可能需要处理 referrer 问题，因为 Bangumi 图片可能有防盗链
  const imgUrl = anime.img_url?.replace('http://', 'https://') || '';

  const handleMark = (e: React.MouseEvent, newStatus: AnimeStatus) => {
    e.stopPropagation();
    onMark(anime.subject_id, newStatus === status ? 'unmarked' : newStatus);
  };

  return (
    <motion.div
      layoutId={`card-${anime.subject_id}`}
      className={`relative rounded-lg border overflow-hidden transition-all duration-200 cursor-pointer group ${statusColors[status]}`}
      onClick={() => onOpenDetail(anime)}
      whileHover={{ scale: 1.02 }}
    >
      <div className="flex h-full">
        {/* 封面图 */}
        <div className={`relative shrink-0 ${viewMode === 'small' ? 'w-16' : viewMode === 'medium' ? 'w-24' : 'w-32'}`}>
          {imgUrl ? (
            <img
              src={imgUrl}
              alt={anime.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-500 text-xs">
              无封面
            </div>
          )}

          {/* 评分角标 */}
          <div className="absolute top-0 left-0 bg-black/70 px-1.5 py-0.5 text-xs text-yellow-400 font-bold rounded-br">
            {anime.平均分?.toFixed(1) || '-'}
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 p-3 flex flex-col min-w-0">
          <div className="flex justify-between items-start gap-2">
            <h3 className="font-medium text-sm line-clamp-2 text-gray-100" title={anime.title}>
              {anime.title}
            </h3>
            {userRating && (
              <div className="flex items-center text-yellow-400 text-xs gap-0.5 shrink-0">
                <Star size={12} fill="currentColor" />
                <span>{userRating}</span>
              </div>
            )}
          </div>

          <div className="text-xs text-gray-400 mt-1 flex gap-2">
            <span>{anime.year || '未知'}</span>
            <span>{anime.tags?.split(' ').slice(0, 2).join(' / ')}</span>
          </div>

          <div className="mt-auto flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity pt-2">
            <button
              onClick={(e) => handleMark(e, 'watched')}
              className={`p-1.5 rounded-full transition-colors ${status === 'watched' ? 'bg-green-500 text-white' : 'bg-gray-700 hover:bg-green-600 text-gray-300'}`}
              title="标记为已看 (J)"
            >
              <Check size={14} />
            </button>
            <button
              onClick={(e) => handleMark(e, 'wishlist')}
              className={`p-1.5 rounded-full transition-colors ${status === 'wishlist' ? 'bg-yellow-500 text-white' : 'bg-gray-700 hover:bg-yellow-600 text-gray-300'}`}
              title="标记为想看 (L)"
            >
              <Bookmark size={14} />
            </button>
            <button
              onClick={(e) => handleMark(e, 'skipped')}
              className={`p-1.5 rounded-full transition-colors ${status === 'skipped' ? 'bg-gray-500 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
              title="标记为跳过 (K)"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 状态遮罩 */}
      {status !== 'unmarked' && (
        <div className={`absolute inset-0 pointer-events-none opacity-10 ${
          status === 'watched' ? 'bg-green-500' :
          status === 'wishlist' ? 'bg-yellow-500' : 'bg-gray-500'
        }`} />
      )}
    </motion.div>
  );
});

export default AnimeCard;
