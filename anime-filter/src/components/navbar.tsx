"use client"

/**
 * Navbar Component
 *
 * The main navigation bar for the anime selection interface.
 *
 * Features:
 * - Search input with tag support (use $tagname$ syntax)
 * - View mode toggle (All / Watched)
 * - Layout size toggle (Small / Medium / Large grid)
 * - Filter button to open advanced filter panel
 * - Page info display (page number, selected count)
 * - Active tags display with remove capability
 */

import { useState, type KeyboardEvent } from "react"
import { Search, X, Grid3X3, LayoutGrid, Rows3, SlidersHorizontal } from "lucide-react"

/** View mode determines which anime are shown */
type ViewMode = "all" | "watched"

/** Layout mode determines grid column count */
type LayoutMode = "small" | "medium" | "large"

interface NavbarProps {
  searchQuery: string // Current search text
  onSearchChange: (query: string) => void // Callback when search changes
  viewMode: ViewMode // Current view filter
  onViewModeChange: (mode: ViewMode) => void // Callback when view mode changes
  selectedTags: string[] // Active filter tags
  onAddTag: (tag: string) => void // Callback to add a tag
  onRemoveTag: (tag: string) => void // Callback to remove a tag
  layoutMode: LayoutMode // Current grid layout size
  onLayoutModeChange: (mode: LayoutMode) => void // Callback when layout changes
  watchedCount: number // Total watched anime count
  page: number // Current page number
  selectedCount: number // Currently selected anime count
  onOpenFilters: () => void // Callback to open filter panel
  hasActiveFilters: boolean // Whether any filters are active
  annotatedCount: number // Total items user has interacted with
  totalCount: number // Total items after filtering
}

export function Navbar({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  selectedTags,
  onAddTag,
  onRemoveTag,
  layoutMode,
  onLayoutModeChange,
  watchedCount,
  page,
  selectedCount,
  onOpenFilters,
  hasActiveFilters,
  annotatedCount,
  totalCount,
}: NavbarProps) {
  /** Track search input focus state for styling */
  const [isSearchFocused, setIsSearchFocused] = useState(false)

  /**
   * Handles keyboard events in search input
   * When Enter is pressed with $tag$ syntax, adds it as a filter tag
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.startsWith("$") && searchQuery.endsWith("$")) {
      const tag = searchQuery.slice(1, -1).trim()
      if (tag) {
        onAddTag(tag)
        onSearchChange("")
      }
    }
  }

  return (
    <nav className="sticky top-0 z-40 bg-card/90 backdrop-blur-lg border-b border-border/30">
      <div className="max-w-7xl mx-auto px-4 lg:px-6">
        {/* Main navbar row */}
        <div className="flex items-center gap-4 h-16">
          {/* Logo / Brand */}
          <div className="flex-shrink-0">
            <h1 className="text-lg font-bold text-foreground tracking-tight">
              Anime<span className="text-primary">Pick</span>
            </h1>
          </div>

          {/* Search input with $tag$ support */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search anime or tag by $tag$..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className={`
                w-full pl-10 pr-10 py-2.5 rounded-xl bg-muted/60 text-sm text-foreground
                placeholder:text-muted-foreground/50 outline-none transition-all
                ${isSearchFocused ? "ring-2 ring-primary/40 bg-card" : "hover:bg-muted/80"}
              `}
            />
            {/* Clear search button */}
            {searchQuery && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* View mode toggle (All / Watched) */}
          <div className="hidden sm:flex items-center bg-muted/60 rounded-xl p-1">
            <button
              onClick={() => onViewModeChange("all")}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${
                  viewMode === "all"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }
              `}
            >
              All
            </button>
            <button
              onClick={() => onViewModeChange("watched")}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
                ${
                  viewMode === "watched"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }
              `}
            >
              Watched
              {/* Badge showing watched count */}
              {watchedCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-primary/20 text-primary-foreground text-xs font-semibold">
                  {watchedCount}
                </span>
              )}
            </button>
          </div>

          {/* Layout size toggle buttons */}
          <div className="hidden md:flex items-center bg-muted/60 rounded-xl p-1 gap-0.5">
            <button
              onClick={() => onLayoutModeChange("small")}
              className={`
                p-2 rounded-lg transition-all
                ${
                  layoutMode === "small"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }
              `}
              title="Small cards (more per row)"
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onLayoutModeChange("medium")}
              className={`
                p-2 rounded-lg transition-all
                ${
                  layoutMode === "medium"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }
              `}
              title="Medium cards (default)"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => onLayoutModeChange("large")}
              className={`
                p-2 rounded-lg transition-all
                ${
                  layoutMode === "large"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }
              `}
              title="Large cards (fewer per row)"
            >
              <Rows3 className="h-4 w-4" />
            </button>
          </div>

          {/* Filter panel trigger button */}
          <button
            onClick={onOpenFilters}
            className={`
              relative p-2.5 rounded-xl transition-all
              ${
                hasActiveFilters
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
              }
            `}
            title="Open filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {/* Active filter indicator dot */}
            {hasActiveFilters && (
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-secondary border-2 border-card" />
            )}
          </button>

          {/* Page info display */}
          <div className="hidden lg:flex items-center gap-3 text-sm text-muted-foreground bg-muted/40 px-4 py-2 rounded-xl">
            <span className="font-medium text-foreground">Page {page}</span>
            <span className="text-border">|</span>
            <span>{selectedCount} selected</span>
            <span className="text-border">|</span>
            <span className="text-xs text-primary/80">{annotatedCount} / {totalCount} reviewed</span>
          </div>
        </div>

        {/* Tags row - shown when tags are active */}
        {selectedTags.length > 0 && (
          <div className="flex items-center gap-2 pb-3 overflow-x-auto scrollbar-hide">
            <span className="text-xs text-muted-foreground flex-shrink-0 font-medium">Active Tags:</span>
            {selectedTags.map((tag) => (
              <button
                key={tag}
                onClick={() => onRemoveTag(tag)}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary/20 text-foreground flex items-center gap-2 flex-shrink-0 hover:bg-primary/30 transition-colors"
              >
                {tag}
                <X className="h-3 w-3 opacity-60" />
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}
