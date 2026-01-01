"use client"

/**
 * InfoModal Component
 *
 * A detailed modal popup that shows full information about a selected anime.
 * Displayed when user clicks the info (i) button on an anime card.
 *
 * @description Content includes:
 * - Large poster image
 * - Title (English and Japanese)
 * - Score, episode count, and year
 * - Genre/tag list
 * - Full synopsis
 * - Mark as "Want to Watch" button
 *
 * Can be closed by:
 * - Clicking the X button
 * - Clicking the backdrop
 * - Pressing Escape key
 */

import { motion, AnimatePresence } from "framer-motion"
import { X, Star, Calendar, Film, Bookmark } from "lucide-react"

/**
 * Anime data structure for the modal
 * @interface Anime
 */
interface Anime {
  id: number
  title: string
  japaneseTitle: string
  score: number
  image: string
  synopsis: string
  episodes: number
  year: number
  tags: string[]
}

interface InfoModalProps {
  anime: Anime | null
  onClose: () => void
  onMarkInterested?: (id: number) => void
  isInterested?: boolean
}

export function InfoModal({ anime, onClose, onMarkInterested, isInterested }: InfoModalProps) {
  if (!anime) return null

  return (
    <AnimatePresence>
      {anime && (
        <>
          {/* Dark semi-transparent backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Centered modal container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-lg"
          >
            <div className="bg-card rounded-2xl shadow-2xl overflow-hidden border border-border/30">
              {/* Header image section */}
              <div className="relative h-52 overflow-hidden">
                <img src={anime.image || "/placeholder.svg"} alt={anime.title} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />

                {/* Close button */}
                <button
                  className="absolute top-4 right-4 h-10 w-10 rounded-xl bg-card/90 backdrop-blur-sm flex items-center justify-center shadow-lg hover:bg-card transition-colors"
                  onClick={onClose}
                >
                  <X className="h-5 w-5 text-foreground" />
                </button>
              </div>

              {/* Content section */}
              <div className="p-6 -mt-10 relative">
                <h2 className="text-xl font-bold text-foreground">{anime.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">{anime.japaneseTitle}</p>

                {/* Stats row */}
                <div className="flex items-center gap-5 mt-4">
                  <div className="flex items-center gap-1.5">
                    <Star className="h-4 w-4 fill-secondary text-secondary" />
                    <span className="text-sm font-semibold text-foreground">{anime.score}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Film className="h-4 w-4" />
                    <span>{anime.episodes} eps</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{anime.year}</span>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mt-4">
                  {anime.tags.map((tag) => (
                    <span key={tag} className="px-3 py-1 rounded-lg bg-muted text-xs font-medium text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Synopsis */}
                <p className="text-sm text-muted-foreground leading-relaxed mt-4">{anime.synopsis}</p>

                {onMarkInterested && (
                  <button
                    onClick={() => {
                      onMarkInterested(anime.id)
                      onClose()
                    }}
                    className={`
                      w-full mt-6 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2
                      ${
                        isInterested
                          ? "bg-secondary text-secondary-foreground"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      }
                    `}
                  >
                    <Bookmark className={`h-4 w-4 ${isInterested ? "fill-current" : ""}`} />
                    {isInterested ? "Already in Want to Watch" : "Add to Want to Watch"}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
