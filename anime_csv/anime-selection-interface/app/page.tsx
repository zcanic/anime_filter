"use client"

/**
 * Home Page Component
 *
 * The main entry point for the anime selection application.
 *
 * @description State Management:
 * - page: Current page number for pagination
 * - watchedAnime: Array of anime IDs that user has marked as watched
 * - interestedAnime: Array of anime IDs that user has marked as interested (want to watch)
 *
 * @description User Flow:
 * 1. User browses anime cards in the grid
 * 2. User can swipe cards left (skip) or right (interested)
 * 3. User can click cards to select multiple
 * 4. Press Q or click "Skip Page" to skip current page
 * 5. Press E or click "Confirm & Next" to save selections and advance
 * 6. Press R or click undo to revert last action
 *
 * @remarks Backend Integration:
 * Replace the local state with API calls for production:
 * ```typescript
 * // Example API integration
 * const { data: watchedAnime, mutate } = useSWR('/api/user/watched', fetcher)
 *
 * const handleSubmit = async (selectedIds: number[]) => {
 *   await fetch('/api/user/watched', {
 *     method: 'POST',
 *     body: JSON.stringify({ ids: selectedIds })
 *   })
 *   mutate()
 *   setPage(prev => prev + 1)
 * }
 * ```
 */

import { useState, useCallback } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { AnimeGrid } from "@/components/anime-grid"

export default function Home() {
  // --------------------------------------------------------------------------
  // STATE
  // --------------------------------------------------------------------------

  /** Current page number (starts at 1) */
  const [page, setPage] = useState(1)

  /** IDs of anime marked as watched through confirm action */
  const [watchedAnime, setWatchedAnime] = useState<number[]>([])

  /** IDs of anime marked as interested through swipe right or modal button */
  const [interestedAnime, setInterestedAnime] = useState<number[]>([])

  // --------------------------------------------------------------------------
  // CALLBACKS
  // --------------------------------------------------------------------------

  /**
   * Handle page confirmation
   * Adds selected anime to watched list and advances to next page
   *
   * @param selectedIds - Array of anime IDs selected on current page
   *
   * @example Backend integration:
   * ```typescript
   * const handleSubmit = async (selectedIds: number[]) => {
   *   await api.markAsWatched(selectedIds)
   *   await mutate('/api/user/watched')
   *   setPage(prev => prev + 1)
   * }
   * ```
   */
  const handleSubmit = useCallback((selectedIds: number[]) => {
    setWatchedAnime((prev) => [...new Set([...prev, ...selectedIds])])
    setPage((prev) => prev + 1)
  }, [])

  /**
   * Handle page skip
   * Simply advances to next page without saving selections
   */
  const handleSkip = useCallback(() => {
    setPage((prev) => prev + 1)
  }, [])

  /**
   * Handle going to previous page
   * Decrements page if not on first page
   */
  const handlePrevious = useCallback(() => {
    setPage((prev) => Math.max(1, prev - 1))
  }, [])

  /**
   * Handle marking anime as interested (want to watch)
   * Called from swipe right or info modal button
   *
   * @param id - Anime ID to mark as interested
   */
  const handleMarkInterested = useCallback((id: number) => {
    setInterestedAnime((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }, [])

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------

  return (
    <main className="relative">
      {/* Page transition animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={page}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <AnimeGrid
            onSubmit={handleSubmit}
            onSkip={handleSkip}
            onPrevious={handlePrevious}
            onMarkInterested={handleMarkInterested}
            watchedIds={watchedAnime}
            interestedIds={interestedAnime}
            page={page}
          />
        </motion.div>
      </AnimatePresence>
    </main>
  )
}
