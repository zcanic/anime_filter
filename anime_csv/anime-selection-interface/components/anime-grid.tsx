"use client"

/**
 * AnimeGrid Component
 *
 * The main grid container that manages anime cards display and interactions.
 *
 * @description Features:
 * - Displays anime cards in a responsive grid layout
 * - Handles individual card swipe actions (left=skip, right=watched)
 * - Manages card replacement logic (new card appears in same position)
 * - Integrates with navbar filters and search
 * - Keyboard shortcuts (Q=skip page, E=confirm & next, R=undo)
 * - Always maintains exactly 10 cards visible (when possible)
 *
 * @remarks Card Replacement Logic:
 * When a card is swiped, the new card replaces it at the SAME grid position.
 * Other cards do not shift. This is achieved by tracking grid positions
 * independently from anime IDs.
 */

import { useState, useEffect, useMemo, useCallback } from "react"
import { AnimeCard } from "./anime-card"
import { InfoModal } from "./info-modal"
import { Navbar } from "./navbar"
import { KeyboardGuide } from "./keyboard-guide"
import { FilterPanel, type FilterConfig } from "./filter-panel"
import { SkipForward, Check, Undo2 } from "lucide-react"

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Anime data structure
 * @interface AnimeData
 * @description This interface should match your backend API response
 */
export interface AnimeData {
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

/** Grid layout options */
export type LayoutMode = "small" | "medium" | "large"

/** View mode for filtering */
export type ViewMode = "all" | "watched"

/**
 * History entry for undo functionality
 * @interface HistoryEntry
 */
interface HistoryEntry {
  type: "swipe" | "page"
  animeId?: number
  position?: number
  previousAnimeId?: number
  page?: number
  selectedIds?: number[]
}

// ============================================================================
// DEMO DATA - Replace with API call in production
// ============================================================================

/**
 * Demo anime data for development
 * @description Replace this with your actual data fetching logic
 * Example API integration:
 * ```typescript
 * const fetchAnime = async (page: number, filters: FilterConfig): Promise<AnimeData[]> => {
 *   const response = await fetch(`/api/anime?page=${page}&...filters`)
 *   return response.json()
 * }
 * ```
 */
const DEMO_ANIME_DATA: AnimeData[] = [
  {
    id: 1,
    title: "Violet Evergarden",
    japaneseTitle: "ヴァイオレット・エヴァーガーデン",
    score: 8.9,
    image: "/anime-girl-with-blonde-hair-writing-letters-violet.jpg",
    synopsis:
      "The story of a young girl who was raised as a weapon of war, now searching for the meaning of the words 'I love you' as she works as an Auto Memory Doll.",
    episodes: 13,
    year: 2018,
    tags: ["日本", "Drama", "Fantasy"],
  },
  {
    id: 2,
    title: "Your Name",
    japaneseTitle: "君の名は。",
    score: 9.0,
    image: "/anime-comet-in-sky-twilight-beautiful-scenery-your.jpg",
    synopsis:
      "Two teenagers share a profound, magical connection upon discovering they are swapping bodies, and set out to meet each other across the vast distance.",
    episodes: 1,
    year: 2016,
    tags: ["日本", "Romance", "Fantasy"],
  },
  {
    id: 3,
    title: "A Silent Voice",
    japaneseTitle: "聲の形",
    score: 8.8,
    image: "/anime-girl-with-hearing-aid-peaceful-garden-scene.jpg",
    synopsis:
      "A young man is ostracized by his classmates after bullying a deaf girl to the point where she moves away. Years later, he sets out to make amends.",
    episodes: 1,
    year: 2016,
    tags: ["日本", "Drama", "Romance"],
  },
  {
    id: 4,
    title: "Spirited Away",
    japaneseTitle: "千と千尋の神隠し",
    score: 8.9,
    image: "/anime-bathhouse-fantasy-spirits-ghibli-style-night.jpg",
    synopsis:
      "During her family's move to the suburbs, a sullen 10-year-old girl wanders into a world ruled by gods, witches, and spirits.",
    episodes: 1,
    year: 2001,
    tags: ["日本", "Ghibli", "Fantasy"],
  },
  {
    id: 5,
    title: "March Comes in Like a Lion",
    japaneseTitle: "3月のライオン",
    score: 8.6,
    image: "/anime-boy-playing-shogi-contemplative-mood-soft-li.jpg",
    synopsis:
      "A professional shogi player struggles with depression while finding solace in the company of three sisters who welcome him into their home.",
    episodes: 44,
    year: 2016,
    tags: ["日本", "Drama", "Slice of Life"],
  },
  {
    id: 6,
    title: "Weathering With You",
    japaneseTitle: "天気の子",
    score: 8.3,
    image: "/anime-girl-praying-to-sky-rain-clouds-sunshine-bre.jpg",
    synopsis: "A high-school boy who runs away to Tokyo befriends a girl who can manipulate the weather.",
    episodes: 1,
    year: 2019,
    tags: ["日本", "Romance", "Fantasy"],
  },
  {
    id: 7,
    title: "Anohana",
    japaneseTitle: "あの花",
    score: 8.4,
    image: "/anime-ghost-girl-white-dress-summer-flowers-peacef.jpg",
    synopsis:
      "A group of childhood friends drift apart after one of them dies in an accident. Years later, her ghost appears to reunite them.",
    episodes: 11,
    year: 2011,
    tags: ["日本", "Drama", "Supernatural"],
  },
  {
    id: 8,
    title: "Howl's Moving Castle",
    japaneseTitle: "ハウルの動く城",
    score: 8.7,
    image: "/anime-steampunk-castle-flying-sky-magical-ghibli-s.jpg",
    synopsis: "A young woman cursed with an old body by a witch encounters a wizard and his magical castle.",
    episodes: 1,
    year: 2004,
    tags: ["日本", "Ghibli", "Fantasy", "Romance"],
  },
  {
    id: 9,
    title: "My Neighbor Totoro",
    japaneseTitle: "となりのトトロ",
    score: 8.5,
    image: "/anime-forest-spirit-fluffy-creature-children-count.jpg",
    synopsis: "Two sisters move to the countryside and discover the existence of magical creatures called Totoros.",
    episodes: 1,
    year: 1988,
    tags: ["日本", "Ghibli", "Family"],
  },
  {
    id: 10,
    title: "The Garden of Words",
    japaneseTitle: "言の葉の庭",
    score: 8.1,
    image: "/anime-rain-garden-gazebo-peaceful-romantic-makoto-.jpg",
    synopsis:
      "A 15-year-old boy and 27-year-old woman find an unlikely friendship in Tokyo's Shinjuku Garden on rainy mornings.",
    episodes: 1,
    year: 2013,
    tags: ["日本", "Romance", "Slice of Life"],
  },
  {
    id: 11,
    title: "Clannad",
    japaneseTitle: "クラナド",
    score: 8.5,
    image: "/anime-school-romance-drama.jpg",
    synopsis: "A delinquent high school student meets a mysterious girl and discovers the importance of family.",
    episodes: 23,
    year: 2007,
    tags: ["日本", "Drama", "Romance"],
  },
  {
    id: 12,
    title: "Your Lie in April",
    japaneseTitle: "四月は君の嘘",
    score: 8.7,
    image: "/anime-piano-music-romance.jpg",
    synopsis: "A piano prodigy who lost his ability to hear music meets a free-spirited violinist.",
    episodes: 22,
    year: 2014,
    tags: ["日本", "Drama", "Romance", "Music"],
  },
  {
    id: 13,
    title: "5 Centimeters Per Second",
    japaneseTitle: "秒速5センチメートル",
    score: 7.8,
    image: "/anime-cherry-blossom-train-station.jpg",
    synopsis: "Three short films following the life of Takaki Tono and his relationships.",
    episodes: 1,
    year: 2007,
    tags: ["日本", "Drama", "Romance"],
  },
  {
    id: 14,
    title: "Wolf Children",
    japaneseTitle: "おおかみこどもの雨と雪",
    score: 8.5,
    image: "/anime-mother-children-wolves-countryside.jpg",
    synopsis: "A young mother raises her two werewolf children alone after their father's death.",
    episodes: 1,
    year: 2012,
    tags: ["日本", "Drama", "Fantasy", "Family"],
  },
]

// ============================================================================
// CONSTANTS
// ============================================================================

/** Number of cards to display at once */
const CARDS_PER_PAGE = 10

/** Grid column classes based on layout mode */
const GRID_COLS: Record<LayoutMode, string> = {
  small: "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6",
  medium: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
  large: "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
}

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface AnimeGridProps {
  /** Callback when page is confirmed with selected anime IDs */
  onSubmit: (selectedIds: number[]) => void
  /** Callback when page is skipped */
  onSkip: () => void
  /** IDs of anime marked as watched */
  watchedIds: number[]
  /** IDs of anime marked as interested */
  interestedIds: number[]
  /** Current page number */
  page: number
  /** Callback to go to previous page */
  onPrevious?: () => void
  /** Callback to mark anime as interested */
  onMarkInterested?: (id: number) => void
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AnimeGrid({
  onSubmit,
  onSkip,
  watchedIds,
  interestedIds,
  page,
  onPrevious,
  onMarkInterested,
}: AnimeGridProps) {
  // --------------------------------------------------------------------------
  // STATE MANAGEMENT
  // --------------------------------------------------------------------------

  /** Currently selected anime IDs for this page */
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  /** Search query from navbar */
  const [searchQuery, setSearchQuery] = useState("")

  /** View mode filter (all or watched only) */
  const [viewMode, setViewMode] = useState<ViewMode>("all")

  /** Active filter tags */
  const [selectedTags, setSelectedTags] = useState<string[]>(["日本"])

  /** Current grid layout size */
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("medium")

  /** Anime being shown in info modal (null = closed) */
  const [modalAnime, setModalAnime] = useState<AnimeData | null>(null)

  /** Filter panel visibility */
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  /** Advanced filter configuration */
  const [filters, setFilters] = useState<FilterConfig>({
    minRating: 0,
    yearStart: null,
    yearEnd: null,
    watchStatus: "all",
  })

  /**
   * Grid positions array - each position holds an anime ID
   * This allows cards to be replaced in-place when swiped
   * Position index is preserved, only the anime ID changes
   */
  const [gridPositions, setGridPositions] = useState<number[]>(
    DEMO_ANIME_DATA.slice(0, CARDS_PER_PAGE).map((a) => a.id),
  )

  /** IDs of anime that have been skipped (swiped left) */
  const [skippedIds, setSkippedIds] = useState<number[]>([])

  /** History stack for undo functionality */
  const [history, setHistory] = useState<HistoryEntry[]>([])

  // --------------------------------------------------------------------------
  // COMPUTED VALUES
  // --------------------------------------------------------------------------

  /**
   * Check if any advanced filters are active
   */
  const hasActiveFilters = useMemo(
    () =>
      filters.minRating > 0 || filters.yearStart !== null || filters.yearEnd !== null || filters.watchStatus !== "all",
    [filters],
  )

  /**
   * Build ordered list of anime to display
   * Maintains grid position order for stable layout
   */
  const orderedAnime = useMemo(() => {
    return gridPositions
      .map((id) => DEMO_ANIME_DATA.find((a) => a.id === id))
      .filter((anime): anime is AnimeData => anime !== undefined)
  }, [gridPositions])

  /**
   * Apply all filters to determine which anime to show
   */
  const filteredAnime = useMemo(() => {
    return orderedAnime.filter((anime) => {
      // Search filter (skip if using $tag$ syntax)
      const isTagInput = searchQuery.startsWith("$") && searchQuery.endsWith("$")
      const matchesSearch =
        searchQuery === "" ||
        isTagInput ||
        anime.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        anime.japaneseTitle.includes(searchQuery)

      // View mode filter
      const matchesViewMode = viewMode === "all" || (viewMode === "watched" && watchedIds.includes(anime.id))

      // Tags filter - anime must have ALL selected tags
      const matchesTags = selectedTags.length === 0 || selectedTags.every((tag) => anime.tags.includes(tag))

      // Rating filter
      const matchesRating = anime.score >= filters.minRating

      // Year range filter
      const matchesYearStart = !filters.yearStart || anime.year >= filters.yearStart
      const matchesYearEnd = !filters.yearEnd || anime.year <= filters.yearEnd

      // Watch status filter from filter panel
      let matchesWatchStatus = true
      if (filters.watchStatus === "watched") {
        matchesWatchStatus = watchedIds.includes(anime.id)
      } else if (filters.watchStatus === "unwatched") {
        matchesWatchStatus = !watchedIds.includes(anime.id)
      } else if (filters.watchStatus === "interested") {
        matchesWatchStatus = interestedIds.includes(anime.id)
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
    })
  }, [orderedAnime, searchQuery, viewMode, selectedTags, watchedIds, interestedIds, filters])

  // --------------------------------------------------------------------------
  // CALLBACKS
  // --------------------------------------------------------------------------

  /**
   * Toggle selection state for a card
   */
  const handleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }, [])

  /**
   * Add a new tag to the filter list
   */
  const handleAddTag = useCallback((tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]))
  }, [])

  /**
   * Remove a tag from the filter list
   */
  const handleRemoveTag = useCallback((tag: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag))
  }, [])

  /**
   * Replace a card at its current grid position with a new anime
   * The new card appears in the SAME position - no shifting occurs
   *
   * @param removedId - ID of the anime to replace
   * @param positionIndex - Grid position index where replacement should occur
   */
  const replaceCardAtPosition = useCallback(
    (removedId: number, positionIndex: number) => {
      // Find all IDs currently in use or previously used
      const usedIds = new Set([...gridPositions, ...skippedIds, ...watchedIds])

      // Find next available anime not already used
      const availableAnime = DEMO_ANIME_DATA.filter((a) => !usedIds.has(a.id))

      if (availableAnime.length > 0) {
        const newAnime = availableAnime[0]

        // Save to history for undo
        setHistory((prev) => [
          ...prev,
          {
            type: "swipe",
            animeId: newAnime.id,
            position: positionIndex,
            previousAnimeId: removedId,
          },
        ])

        // Replace at exact position
        setGridPositions((prev) => {
          const newPositions = [...prev]
          newPositions[positionIndex] = newAnime.id
          return newPositions
        })
      }
    },
    [gridPositions, skippedIds, watchedIds],
  )

  /**
   * Handle swipe left action (skip anime)
   */
  const handleSwipeLeft = useCallback(
    (id: number, positionIndex: number) => {
      setSkippedIds((prev) => [...prev, id])
      replaceCardAtPosition(id, positionIndex)
    },
    [replaceCardAtPosition],
  )

  /**
   * Handle swipe right action (mark as interested/watched)
   */
  const handleSwipeRight = useCallback(
    (id: number, positionIndex: number) => {
      setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
      if (onMarkInterested) {
        onMarkInterested(id)
      }
      replaceCardAtPosition(id, positionIndex)
    },
    [replaceCardAtPosition, onMarkInterested],
  )

  /**
   * Undo last action
   */
  const handleUndo = useCallback(() => {
    if (history.length === 0) {
      // If no swipe history, go to previous page
      if (onPrevious && page > 1) {
        onPrevious()
      }
      return
    }

    const lastAction = history[history.length - 1]

    if (lastAction.type === "swipe" && lastAction.previousAnimeId !== undefined && lastAction.position !== undefined) {
      // Restore the previous anime at the position
      setGridPositions((prev) => {
        const newPositions = [...prev]
        newPositions[lastAction.position!] = lastAction.previousAnimeId!
        return newPositions
      })

      // Remove from skipped if it was there
      setSkippedIds((prev) => prev.filter((id) => id !== lastAction.previousAnimeId))

      // Remove from selected if it was added
      setSelectedIds((prev) => prev.filter((id) => id !== lastAction.previousAnimeId))
    }

    // Remove last history entry
    setHistory((prev) => prev.slice(0, -1))
  }, [history, onPrevious, page])

  // --------------------------------------------------------------------------
  // KEYBOARD SHORTCUTS
  // --------------------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in an input
      if (document.activeElement?.tagName === "INPUT") return

      switch (e.key.toLowerCase()) {
        case "q":
          onSkip()
          break
        case "e":
          onSubmit(selectedIds)
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
  }, [onSkip, onSubmit, selectedIds, modalAnime, isFilterOpen, handleUndo])

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation bar with search, filters, and controls */}
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
      />

      {/* Main content area with anime grid */}
      <div className="px-4 lg:px-6 py-6">
        <div className="max-w-7xl mx-auto">
          {filteredAnime.length > 0 ? (
            <div className={`grid ${GRID_COLS[layoutMode]} gap-4 lg:gap-5`}>
              {filteredAnime.map((anime) => {
                // Find the actual grid position for this anime
                const gridIndex = gridPositions.indexOf(anime.id)
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
                  />
                )
              })}
            </div>
          ) : (
            /* Empty state */
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
            </div>
          )}
        </div>
      </div>

      {/* Floating action buttons */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20">
        {/* Undo button */}
        <button
          className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-card shadow-lg text-muted-foreground text-sm font-medium hover:text-foreground hover:bg-muted transition-colors border border-border/50"
          onClick={handleUndo}
          title="Undo (R)"
        >
          <Undo2 className="h-4 w-4" />
        </button>

        {/* Skip page button */}
        <button
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-card shadow-lg text-foreground text-sm font-medium hover:bg-muted transition-colors border border-border/50"
          onClick={onSkip}
        >
          <SkipForward className="h-4 w-4" />
          Skip Page
        </button>

        {/* Confirm and next button */}
        <button
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-primary shadow-lg text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          onClick={() => onSubmit(selectedIds)}
        >
          <Check className="h-4 w-4" />
          Confirm & Next
          {selectedIds.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-md bg-card/20 text-xs">{selectedIds.length}</span>
          )}
        </button>
      </div>

      {/* Keyboard shortcut guide */}
      <KeyboardGuide />

      {/* Info modal */}
      <InfoModal
        anime={modalAnime}
        onClose={() => setModalAnime(null)}
        onMarkInterested={onMarkInterested}
        isInterested={modalAnime ? interestedIds.includes(modalAnime.id) : false}
      />

      {/* Filter panel */}
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
