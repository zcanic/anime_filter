"use client"

/**
 * FilterPanel Component
 *
 * A slide-in panel from the right side that provides advanced filtering options
 * for the anime collection.
 *
 * @description Filters include:
 * - Rating range (minimum score)
 * - Year range (start/end year)
 * - Tags (synced with navbar tags)
 * - Watch status (All, Watched, Unwatched, Interested)
 *
 * The panel has a semi-transparent backdrop and can be closed by clicking
 * outside or pressing the close button.
 */

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Star, Calendar, Tag, Eye, EyeOff, Heart, ThumbsDown } from "lucide-react"

/**
 * Filter configuration type
 * @property {number} minRating - Minimum score filter (0-10)
 * @property {number|null} yearStart - Start year for filtering
 * @property {number|null} yearEnd - End year for filtering
 * @property {string} watchStatus - Watch status filter
 */
export interface FilterConfig {
  minRating: number
  yearStart: number | null
  yearEnd: number | null
  watchStatus: "all" | "watched" | "unwatched" | "interested" | "skipped"
}

interface FilterPanelProps {
  isOpen: boolean
  onClose: () => void
  filters: FilterConfig
  onFiltersChange: (filters: FilterConfig) => void
  selectedTags: string[]
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
}

export function FilterPanel({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  selectedTags,
  onAddTag,
  onRemoveTag,
}: FilterPanelProps) {
  /** Local state for tag input field */
  const [tagInput, setTagInput] = useState("")

  /**
   * Handles adding a new tag when Enter is pressed
   * Clears the input field after adding
   */
  const handleAddTag = () => {
    if (tagInput.trim()) {
      onAddTag(tagInput.trim())
      setTagInput("")
    }
  }

  /**
   * Updates a single filter value while preserving others
   * @param key - The filter key to update
   * @param value - The new value for the filter
   */
  const updateFilter = <K extends keyof FilterConfig>(key: K, value: FilterConfig[K]) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Semi-transparent backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-foreground/10 backdrop-blur-[2px] z-40"
            onClick={onClose}
          />

          {/* Slide-in panel from right side */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-card/95 backdrop-blur-md shadow-2xl z-50 overflow-y-auto"
          >
            {/* Panel Header */}
            <div className="sticky top-0 bg-card/95 backdrop-blur-md border-b border-border/50 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Filters</h2>
              <button
                onClick={onClose}
                className="h-9 w-9 rounded-xl bg-muted/80 flex items-center justify-center hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="p-6 space-y-8">
              {/* Rating Filter Section */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Star className="h-4 w-4 text-secondary" />
                  <span>Minimum Rating</span>
                </div>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={filters.minRating}
                    onChange={(e) => updateFilter("minRating", Number.parseFloat(e.target.value))}
                    className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0</span>
                    <span className="font-medium text-foreground">{filters.minRating}+</span>
                    <span>10</span>
                  </div>
                </div>
              </section>

              {/* Year Range Filter Section */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span>Year Range</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">From</label>
                    <input
                      type="number"
                      placeholder="1980"
                      value={filters.yearStart || ""}
                      onChange={(e) =>
                        updateFilter("yearStart", e.target.value ? Number.parseInt(e.target.value) : null)
                      }
                      className="w-full px-3 py-2 rounded-xl bg-muted/50 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">To</label>
                    <input
                      type="number"
                      placeholder="2024"
                      value={filters.yearEnd || ""}
                      onChange={(e) => updateFilter("yearEnd", e.target.value ? Number.parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 rounded-xl bg-muted/50 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>
              </section>

              {/* Tags Filter Section */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Tag className="h-4 w-4 text-accent" />
                  <span>Tags</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add a tag..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                    className="flex-1 px-3 py-2 rounded-xl bg-muted/50 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    Add
                  </button>
                </div>
                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => onRemoveTag(tag)}
                        className="px-3 py-1.5 rounded-full bg-primary/20 text-foreground text-xs font-medium flex items-center gap-1.5 hover:bg-primary/30 transition-colors"
                      >
                        {tag}
                        <X className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {/* Watch Status Filter Section */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span>Watch Status</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => updateFilter("watchStatus", "all")}
                    className={`
                      px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2
                      ${
                        filters.watchStatus === "all"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      }
                    `}
                  >
                    All
                  </button>
                  <button
                    onClick={() => updateFilter("watchStatus", "watched")}
                    className={`
                      px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2
                      ${
                        filters.watchStatus === "watched"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      }
                    `}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Watched
                  </button>
                  <button
                    onClick={() => updateFilter("watchStatus", "unwatched")}
                    className={`
                      px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2
                      ${
                        filters.watchStatus === "unwatched"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      }
                    `}
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    Unwatched
                  </button>
                  <button
                    onClick={() => updateFilter("watchStatus", "interested")}
                    className={`
                      px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2
                      ${
                        filters.watchStatus === "interested"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      }
                    `}
                  >
                    <Heart className="h-3.5 w-3.5" />
                    Interested
                  </button>
                  <button
                    onClick={() => updateFilter("watchStatus", "skipped")}
                    className={`
                      px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2
                      ${
                        filters.watchStatus === "skipped"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      }
                    `}
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                    Not Interested
                  </button>
                </div>
              </section>

              {/* Reset Filters Button */}
              <button
                onClick={() => {
                  onFiltersChange({
                    minRating: 0,
                    yearStart: null,
                    yearEnd: null,
                    watchStatus: "all",
                  })
                }}
                className="w-full py-3 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
