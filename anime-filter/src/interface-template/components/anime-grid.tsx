"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { AnimeCard } from "./anime-card"
import { InfoModal } from "./info-modal"
import { Navbar } from "./navbar"
import { KeyboardGuide } from "./keyboard-guide"
import { FilterPanel, type FilterConfig } from "./filter-panel"
import { SkipForward, Check, Undo2, Trash2 } from "lucide-react"

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface AnimeData {
  id: number
  title: string
  japaneseTitle: string
  score: number
  image: string
  synopsis: string
  episodes: number
  year: number
  tags: string // Changed to string for fuzzy search
}

export type LayoutMode = "small" | "medium" | "large"
export type ViewMode = "all" | "watched"

interface HistoryEntry {
  type: "swipe" | "page"
  animeId?: number
  position?: number
  previousAnimeId?: number
  page?: number
  selectedIds?: number[]
}

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface AnimeGridProps {
  onSubmit: (selectedIds: number[]) => void
  onSkip: () => void
  onIgnore?: (ids: number[]) => void
  watchedIds: number[]
  interestedIds: number[]
  skippedIds: number[]
  reviewedSet: Set<number> // New prop for O(1) lookups
  page: number
  onPrevious?: () => void
  onMarkInterested?: (id: number) => void
  onMarkWatched?: (id: number) => void
  onUndoAction?: (id: number) => void
  onResetAll?: () => void // New prop for resetting all data
  data: AnimeData[]
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AnimeGrid({
  onSubmit,
  onSkip,
  onIgnore,
  watchedIds,
  interestedIds,
  skippedIds,
  reviewedSet,
  page,
  onPrevious,
  onMarkInterested,
  onMarkWatched,
  onUndoAction,
  onResetAll,
  data,
}: AnimeGridProps) {
  // --------------------------------------------------------------------------
  // STATE MANAGEMENT
  // --------------------------------------------------------------------------

  const [selectedIds, setSelectedIds] = useState<number[]>([])

  useEffect(() => {
    setSelectedIds([])
  }, [page])

  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("all")
  const [selectedTags, setSelectedTags] = useState<string[]>(["日本"])
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("medium")
  const [modalAnime, setModalAnime] = useState<AnimeData | null>(null)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [filters, setFilters] = useState<FilterConfig>({
    minRating: 0,
    yearStart: null,
    yearEnd: null,
    watchStatus: "all",
  })
  
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)

  // Ref to track IDs assigned in pending state updates to prevent duplicates in rapid succession
  const recentlyAssignedIds = useRef<Set<number>>(new Set())

  const CARDS_PER_PAGE = 10
  const [gridPositions, setGridPositions] = useState<number[]>(
    data.slice(0, CARDS_PER_PAGE).map((a) => a.id),
  )

  useEffect(() => {
    if (gridPositions.length === 0 && data.length > 0) {
      setGridPositions(data.slice(0, CARDS_PER_PAGE).map((a) => a.id))
    }
  }, [data])

  // Clear recently assigned IDs when grid updates
  useEffect(() => {
    recentlyAssignedIds.current.clear()
  }, [gridPositions])

  const [localSkipped, setLocalSkipped] = useState<number[]>([])
  
  // Combine all local and remote skipped for logic
  const allSkipped = useMemo(() => new Set([...skippedIds, ...localSkipped]), [skippedIds, localSkipped])

  const [history, setHistory] = useState<HistoryEntry[]>([])

  // --------------------------------------------------------------------------
  // COMPUTED VALUES
  // --------------------------------------------------------------------------

  const hasActiveFilters = useMemo(
    () =>
      filters.minRating > 0 || filters.yearStart !== null || filters.yearEnd !== null || filters.watchStatus !== "all",
    [filters],
  )

  const orderedAnime = useMemo(() => {
    // For special filter views (watched, skipped, interested), show from full data
    if (filters.watchStatus === "watched") {
      return watchedIds
        .map((id) => data.find((a) => a.id === id))
        .filter((anime): anime is AnimeData => anime !== undefined)
    }
    if (filters.watchStatus === "skipped") {
      return skippedIds
        .map((id) => data.find((a) => a.id === id))
        .filter((anime): anime is AnimeData => anime !== undefined)
    }
    if (filters.watchStatus === "interested") {
      return interestedIds
        .map((id) => data.find((a) => a.id === id))
        .filter((anime): anime is AnimeData => anime !== undefined)
    }
    // For viewMode "watched", override to show watched anime
    if (viewMode === "watched") {
      return watchedIds
        .map((id) => data.find((a) => a.id === id))
        .filter((anime): anime is AnimeData => anime !== undefined)
    }
    return gridPositions
      .map((id) => data.find((a) => a.id === id))
      .filter((anime): anime is AnimeData => anime !== undefined)
  }, [gridPositions, data, viewMode, watchedIds, interestedIds, skippedIds, filters.watchStatus])

  const doesAnimeMatchFilters = useCallback(
    (anime: AnimeData) => {
      const isTagInput = searchQuery.startsWith("$") && searchQuery.endsWith("$")
      const matchesSearch =
        searchQuery === "" ||
        isTagInput ||
        (anime.title && anime.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (anime.japaneseTitle && anime.japaneseTitle.includes(searchQuery))

      const matchesViewMode = viewMode === "all" || (viewMode === "watched" && watchedIds.includes(anime.id))
      
      // FUZZY TAG MATCHING: Check if anime.tags string contains the tag
      const matchesTags = selectedTags.length === 0 || selectedTags.every((tag) => (anime.tags || "").includes(tag));
      
      const matchesRating = (anime.score || 0) >= filters.minRating
      const matchesYearStart = !filters.yearStart || (anime.year || 0) >= filters.yearStart
      const matchesYearEnd = !filters.yearEnd || (anime.year || 9999) <= filters.yearEnd

      let matchesWatchStatus = true
      if (filters.watchStatus === "watched") {
        matchesWatchStatus = watchedIds.includes(anime.id)
      } else if (filters.watchStatus === "unwatched") {
        matchesWatchStatus = !watchedIds.includes(anime.id)
      } else if (filters.watchStatus === "interested") {
        matchesWatchStatus = interestedIds.includes(anime.id)
      } else if (filters.watchStatus === "skipped") {
        matchesWatchStatus = skippedIds.includes(anime.id)
      }

      return (
        matchesSearch &&
        matchesViewMode &&
        matchesTags &&
        matchesRating &&
        matchesYearStart &&
        matchesYearEnd &&
        matchesWatchStatus
      )
    },
    [searchQuery, viewMode, selectedTags, watchedIds, interestedIds, skippedIds, filters],
  )

  const filteredAnime = useMemo(() => {
    return orderedAnime.filter((anime) => doesAnimeMatchFilters(anime))
  }, [orderedAnime, doesAnimeMatchFilters])

  // Context-Aware Statistics Calculation
  const { filteredTotalCount, filteredReviewedCount } = useMemo(() => {
     // 1. Get all anime that match current filters (regardless of whether they are reviewed or not)
     const allMatchingAnime = data.filter(doesAnimeMatchFilters);
     const total = allMatchingAnime.length;

     // 2. Count how many of these are already in the reviewed set
     const reviewed = allMatchingAnime.filter(a => reviewedSet.has(a.id)).length;

     return { filteredTotalCount: total, filteredReviewedCount: reviewed };
  }, [data, doesAnimeMatchFilters, reviewedSet]);


  // --------------------------------------------------------------------------
  // EFFECTS
  // --------------------------------------------------------------------------

  // Replenish grid when filters change
  useEffect(() => {
    if (data.length === 0 || viewMode !== "all") return

    setGridPositions((currentPositions) => {
      const usedIds = new Set([...currentPositions, ...Array.from(allSkipped), ...watchedIds])
      const newPositions = [...currentPositions]

      const validCandidates = data.filter(
        (a) => doesAnimeMatchFilters(a) && !usedIds.has(a.id)
      )

      let candidateIndex = 0

      for (let i = 0; i < CARDS_PER_PAGE; i++) {
        const currentId = newPositions[i]
        const currentAnime = data.find((a) => a.id === currentId)
        
        const isValid = currentAnime && doesAnimeMatchFilters(currentAnime)

        if (!isValid) {
          if (candidateIndex < validCandidates.length) {
            newPositions[i] = validCandidates[candidateIndex].id
            candidateIndex++
          }
        }
      }
      return newPositions
    })    
  }, [
    data, 
    doesAnimeMatchFilters, 
    // Triggers:
    selectedTags,
    filters,
    searchQuery,
    viewMode,
    allSkipped,
    watchedIds
  ])

  // Refresh grid on page change
  useEffect(() => {
    if (data.length === 0) return
    
    setGridPositions(prev => {
       const currentUsed = new Set([...prev, ...Array.from(allSkipped), ...watchedIds])
       const candidates = data.filter(a => !currentUsed.has(a.id) && doesAnimeMatchFilters(a));
       
       const newGrid = [];
       for(let i=0; i<CARDS_PER_PAGE; i++) {
         if (i < candidates.length) {
           newGrid.push(candidates[i].id);
         } else {
           if (prev[i]) newGrid.push(prev[i]);
         }
       }
       return newGrid;
    })
  }, [page]) // Intentionally depends only on page (plus data/filters implicitly via function)

  // --------------------------------------------------------------------------
  // HANDLERS
  // --------------------------------------------------------------------------

  const replaceCardAtPosition = useCallback(
    (removedId: number, positionIndex: number) => {
      const usedIds = new Set([
          ...gridPositions, 
          ...Array.from(allSkipped), 
          ...watchedIds,
          ...Array.from(recentlyAssignedIds.current)
      ])
      const availableAnime = data.filter((a) => !usedIds.has(a.id) && doesAnimeMatchFilters(a))

      const newAnime = availableAnime.length > 0 ? availableAnime[0] : null
      const newAnimeId = newAnime ? newAnime.id : -1

      if (newAnimeId !== -1) {
          recentlyAssignedIds.current.add(newAnimeId)
      }

      setHistory((prev) => [
        ...prev,
        {
          type: "swipe",
          animeId: newAnimeId,
          position: positionIndex,
          previousAnimeId: removedId,
          page: page,
        },
      ])

      setGridPositions((prev) => {
        const newPositions = [...prev]
        newPositions[positionIndex] = newAnimeId
        return newPositions
      })
    },
    [gridPositions, allSkipped, watchedIds, doesAnimeMatchFilters, data, page],
  )

  const handleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }, [])

  const handleAddTag = useCallback((tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]))
  }, [])

  const handleRemoveTag = useCallback((tag: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag))
  }, [])

  const handleSwipeLeft = useCallback(
    (id: number, positionIndex: number) => {
      if (onIgnore) onIgnore([id]);
      setLocalSkipped((prev) => [...prev, id])
      setSelectedIds((prev) => prev.filter((i) => i !== id))
      replaceCardAtPosition(id, positionIndex)
    },
    [replaceCardAtPosition, onIgnore],
  )

  const handleSwipeRight = useCallback(
    (id: number, positionIndex: number) => {
      if (onMarkWatched) {
        onMarkWatched(id)
      }
      setSelectedIds((prev) => prev.filter((i) => i !== id))
      replaceCardAtPosition(id, positionIndex)
    },
    [replaceCardAtPosition, onMarkWatched],
  )

  const handleUndo = useCallback(() => {
    if (history.length === 0) {
      if (onPrevious && page > 1) {
        onPrevious()
      }
      return
    }

    const lastAction = history[history.length - 1]

    // Check if the action belongs to the current page
    if (lastAction.page !== undefined && lastAction.page !== page) {
      if (lastAction.page < page && onPrevious) {
        onPrevious()
      } else if (lastAction.page > page) {
        onSkip()
      }
      return
    }

    if (lastAction.type === "swipe" && lastAction.previousAnimeId !== undefined && lastAction.position !== undefined) {
      // If the card currently in this position (the replacement) was selected, deselect it
      // because it's about to be removed from the grid.
      const currentReplacingId = gridPositions[lastAction.position]
      if (currentReplacingId) {
        setSelectedIds((prev) => prev.filter((id) => id !== currentReplacingId))
      }

      setGridPositions((prev) => {
        const newPositions = [...prev]
        newPositions[lastAction.position!] = lastAction.previousAnimeId!
        return newPositions
      })

      setLocalSkipped((prev) => prev.filter((id) => id !== lastAction.previousAnimeId))
      // Ensure the restored card starts unselected (consistent with swipe behavior clearing selection)
      setSelectedIds((prev) => prev.filter((id) => id !== lastAction.previousAnimeId))
      
      if (onUndoAction && lastAction.previousAnimeId) {
        onUndoAction(lastAction.previousAnimeId);
      }
    }

    setHistory((prev) => prev.slice(0, -1))
  }, [history, onPrevious, page, gridPositions, onUndoAction, onSkip])

  const handleConfirm = () => {
    // Mark selected cards as watched
    onSubmit(selectedIds);
    
    // Mark unselected cards as "not interested" so they don't appear again
    const unselectedIds = gridPositions.filter(id => !selectedIds.includes(id));
    if (onIgnore && unselectedIds.length > 0) {
      onIgnore(unselectedIds);
    }
  }

  const handleSkipPage = () => {
    if (onIgnore) {
      onIgnore(gridPositions);
    }
    onSkip();
  }

  // --------------------------------------------------------------------------
  // KEYBOARD SHORTCUTS
  // --------------------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return

      switch (e.key.toLowerCase()) {
        case "q":
          handleSkipPage()
          break
        case "e":
          handleConfirm()
          break
        case "r":
          handleUndo()
          break
        case "escape":
          if (modalAnime) setModalAnime(null)
          if (isFilterOpen) setIsFilterOpen(false)
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onSkip, onSubmit, selectedIds, modalAnime, isFilterOpen, handleUndo, gridPositions, onIgnore])

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------

  const GRID_COLS: Record<LayoutMode, string> = {
    small: "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6",
    medium: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
    large: "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        selectedTags={selectedTags}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
        layoutMode={layoutMode}
        onLayoutModeChange={setLayoutMode}
        watchedCount={watchedIds.length}
        page={page}
        selectedCount={selectedIds.length}
        onOpenFilters={() => setIsFilterOpen(true)}
        hasActiveFilters={hasActiveFilters}
        annotatedCount={filteredReviewedCount} // Use context-aware reviewed count
        totalCount={filteredTotalCount}         // Use context-aware total count
      />

      <div className="px-4 lg:px-6 py-6">
        <div className="max-w-7xl mx-auto">
          {filteredAnime.length > 0 ? (
            <div className={`grid ${GRID_COLS[layoutMode]} gap-4 lg:gap-5`}>
              {filteredAnime.map((anime, index) => {
                const gridIndex = viewMode === "all" ? gridPositions.indexOf(anime.id) : index
                return (
                  <AnimeCard
                    key={`${anime.id}-${gridIndex}`}
                    anime={anime}
                    isSelected={selectedIds.includes(anime.id)}
                    onSelect={handleSelect}
                    onShowInfo={setModalAnime}
                    onSwipeLeft={(id) => handleSwipeLeft(id, gridIndex)}
                    onSwipeRight={(id) => handleSwipeRight(id, gridIndex)}
                    gridPosition={gridIndex}
                    interactive={viewMode === "all"}
                  />
                )
              })}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎬</span>
              </div>
              <p className="text-muted-foreground">No anime found matching your filters.</p>
              <button
                onClick={() => {
                  setSelectedTags([])
                  setSearchQuery("")
                  setFilters({
                    minRating: 0,
                    yearStart: null,
                    yearEnd: null,
                    watchStatus: "all",
                  })
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-muted text-sm text-foreground hover:bg-muted/80 transition-colors"
              >
                Clear all filters
              </button>

              {/* Reset All Data Section */}
              {onResetAll && (
                <div className="mt-8 pt-8 border-t border-border/50 max-w-xs mx-auto">
                   <h3 className="text-sm font-medium text-muted-foreground mb-3">Data Management</h3>
                   {!isResetConfirmOpen ? (
                     <button
                       onClick={() => setIsResetConfirmOpen(true)}
                       className="px-4 py-2 rounded-xl border border-destructive/30 text-destructive text-sm hover:bg-destructive/10 transition-colors"
                     >
                       Reset All User Data
                     </button>
                   ) : (
                     <div className="flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-200">
                        <p className="text-xs text-destructive mb-1">Are you sure? This cannot be undone.</p>
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => setIsResetConfirmOpen(false)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                                onResetAll();
                                setIsResetConfirmOpen(false);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Confirm Reset
                          </button>
                        </div>
                     </div>
                   )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom action bar - different for watched view vs normal view */}
      {viewMode === "watched" ? (
        /* Watched view: show remove button */
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20">
          <button
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium transition-colors ${
              selectedIds.length > 0
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-card text-muted-foreground border border-border/50 cursor-not-allowed"
            }`}
            onClick={() => {
              if (selectedIds.length > 0 && onUndoAction) {
                selectedIds.forEach(id => onUndoAction(id));
                setSelectedIds([]);
              }
            }}
            disabled={selectedIds.length === 0}
          >
            <Trash2 className="h-4 w-4" />
            Remove from Watched
            {selectedIds.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-md bg-white/20 text-xs">{selectedIds.length}</span>
            )}
          </button>
        </div>
      ) : (
        /* Normal view: show standard action buttons */
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20">
          <button
            className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-card shadow-lg text-muted-foreground text-sm font-medium hover:text-foreground hover:bg-muted transition-colors border border-border/50"
            onClick={handleUndo}
            title="Undo (R)"
          >
            <Undo2 className="h-4 w-4" />
          </button>

          <button
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-card shadow-lg text-foreground text-sm font-medium hover:bg-muted transition-colors border border-border/50"
            onClick={handleSkipPage}
          >
            <SkipForward className="h-4 w-4" />
            Skip Page
          </button>

          <button
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-primary shadow-lg text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            onClick={handleConfirm}
          >
            <Check className="h-4 w-4" />
            Confirm & Next
            {selectedIds.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-md bg-card/20 text-xs">{selectedIds.length}</span>
            )}
          </button>
        </div>
      )}

      {/* Keyboard guide - only show in normal view */}
      {viewMode !== "watched" && <KeyboardGuide />}

      <InfoModal
        anime={modalAnime}
        onClose={() => setModalAnime(null)}
        onMarkInterested={onMarkInterested}
        isInterested={modalAnime ? interestedIds.includes(modalAnime.id) : false}
      />

      <FilterPanel
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onFiltersChange={setFilters}
        selectedTags={selectedTags}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
      />
    </div>
  )
}
