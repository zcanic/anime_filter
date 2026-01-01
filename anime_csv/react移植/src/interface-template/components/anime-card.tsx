"use client"

import type React from "react"

/**
 * AnimeCard Component
 *
 * A draggable card component that displays anime information with swipe gestures.
 *
 * @description Features:
 * - Swipe left to skip the anime
 * - Swipe right to mark as watched/interested
 * - Click to toggle selection
 * - Info button to show detailed modal
 *
 * The card maintains its position in the grid when swiped - only the content
 * is replaced with a new anime from the pool.
 *
 * @remarks The swipe threshold is set to 100px. Cards swiped beyond this
 * threshold will trigger the corresponding action, otherwise they spring
 * back to center.
 */

import { motion, useMotionValue, useTransform, animate, type PanInfo } from "framer-motion"
import { Info, Star, Check, ArrowLeft, ArrowRight } from "lucide-react"
import { useState, useCallback } from "react"

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Anime data structure
 * @interface AnimeData
 */
interface AnimeData {
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

interface AnimeCardProps {
  /** Anime data to display */
  anime: AnimeData
  /** Whether card is currently selected */
  isSelected: boolean
  /** Callback when card is clicked */
  onSelect: (id: number) => void
  /** Callback to show info modal */
  onShowInfo: (anime: AnimeData) => void
  /** Callback when swiped left (skip) */
  onSwipeLeft: (id: number) => void
  /** Callback when swiped right (mark watched) */
  onSwipeRight: (id: number) => void
  /** Position index in the grid (for replacement) */
  gridPosition: number
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Swipe threshold in pixels - card must be dragged this far to trigger action */
const SWIPE_THRESHOLD = 100

/** Animation spring configuration */
const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 500,
  damping: 40,
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AnimeCard({ anime, isSelected, onSelect, onShowInfo, onSwipeLeft, onSwipeRight }: AnimeCardProps) {
  // --------------------------------------------------------------------------
  // MOTION VALUES
  // --------------------------------------------------------------------------

  /**
   * Motion values for drag interaction
   * x: horizontal position during drag
   * rotate: slight rotation based on drag direction
   * opacity: fade effect during drag
   */
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-150, 150], [-6, 6])
  const opacity = useTransform(x, [-150, 0, 150], [0.6, 1, 0.6])

  // --------------------------------------------------------------------------
  // LOCAL STATE
  // --------------------------------------------------------------------------

  /** Track if card is being dragged to prevent click events */
  const [isDragging, setIsDragging] = useState(false)

  // --------------------------------------------------------------------------
  // CALLBACKS
  // --------------------------------------------------------------------------

  /**
   * Handles the end of a drag gesture
   * Determines if swipe threshold was met and triggers appropriate callback
   */
  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.x < -SWIPE_THRESHOLD) {
        // Swipe left animation - skip this anime
        animate(x, -400, SPRING_CONFIG)
        setTimeout(() => {
          onSwipeLeft(anime.id)
          x.set(0)
        }, 150)
      } else if (info.offset.x > SWIPE_THRESHOLD) {
        // Swipe right animation - mark as watched
        animate(x, 400, SPRING_CONFIG)
        setTimeout(() => {
          onSwipeRight(anime.id)
          x.set(0)
        }, 150)
      } else {
        // Return to center if threshold not met
        animate(x, 0, SPRING_CONFIG)
      }

      // Delay resetting drag state to prevent accidental clicks
      setTimeout(() => setIsDragging(false), 100)
    },
    [anime.id, onSwipeLeft, onSwipeRight, x],
  )

  /**
   * Handles card click - only triggers if not dragging
   */
  const handleClick = useCallback(() => {
    if (!isDragging) {
      onSelect(anime.id)
    }
  }, [isDragging, onSelect, anime.id])

  /**
   * Handles info button click - prevents card selection
   */
  const handleInfoClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onShowInfo(anime)
    },
    [onShowInfo, anime],
  )

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------

  return (
    <div className="relative">
      {/* Swipe direction indicators (visible during drag) */}
      <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none z-0">
        <motion.div
          className="h-10 w-10 rounded-full bg-destructive/20 flex items-center justify-center"
          style={{ opacity: useTransform(x, [-100, -50, 0], [1, 0.5, 0]) }}
        >
          <ArrowLeft className="h-5 w-5 text-destructive" />
        </motion.div>
        <motion.div
          className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center"
          style={{ opacity: useTransform(x, [0, 50, 100], [0, 0.5, 1]) }}
        >
          <ArrowRight className="h-5 w-5 text-primary" />
        </motion.div>
      </div>

      {/* Main draggable card */}
      <motion.div
        className="relative cursor-grab active:cursor-grabbing"
        style={{ x, rotate, opacity }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
      >
        <div
          className={`
            relative w-full rounded-2xl bg-card overflow-hidden
            transition-shadow duration-200
            ${isSelected ? "ring-2 ring-primary shadow-lg" : "shadow-md hover:shadow-lg"}
          `}
        >
          {/* Anime poster image section */}
          <div className="relative aspect-[3/4] overflow-hidden">
            <img
              src={anime.image || "/placeholder.svg"}
              alt={anime.title}
              className="h-full w-full object-cover"
              draggable={false}
            />

            {/* Selection checkmark indicator (top-left) */}
            {isSelected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-2 left-2 h-7 w-7 rounded-full bg-primary flex items-center justify-center shadow-md"
              >
                <Check className="h-3.5 w-3.5 text-card" strokeWidth={3} />
              </motion.div>
            )}

            {/* Info button (top-right) */}
            <button
              className="absolute top-2 right-2 h-8 w-8 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center shadow-md hover:bg-card transition-colors"
              onClick={handleInfoClick}
            >
              <Info className="h-4 w-4 text-muted-foreground" />
            </button>

            {/* Year badge (bottom-left) */}
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-card/90 backdrop-blur-sm text-xs font-medium text-foreground">
              {anime.year}
            </div>
          </div>

          {/* Card content section */}
          <div className="p-3 space-y-1.5">
            <h3 className="font-semibold text-sm text-foreground leading-tight line-clamp-1">{anime.title}</h3>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground truncate flex-1">{anime.japaneseTitle}</span>
              <div className="flex items-center gap-1 text-xs flex-shrink-0">
                <Star className="h-3.5 w-3.5 fill-secondary text-secondary" />
                <span className="font-medium text-foreground">{anime.score}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
