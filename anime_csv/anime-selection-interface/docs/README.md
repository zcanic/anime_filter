# Anime Selection Interface - Documentation

## Overview

This is an interactive anime selection interface that allows users to browse, filter, and mark anime as watched or interested. The interface uses a card-based layout with swipe gestures and keyboard shortcuts for efficient browsing.

## Features

### Core Functionality

1. **Card Grid Display**
   - Displays anime in a responsive grid layout
   - Adjustable grid size (Small/Medium/Large)
   - Always maintains up to 10 cards visible

2. **Swipe Interactions (Per Card)**
   - **Swipe Left**: Skip the anime (removes from current view, replaced in-place)
   - **Swipe Right**: Mark as interested and add to "Want to Watch"
   - Cards are replaced at the SAME position - other cards don't shift

3. **Page Navigation**
   - **Skip Page (Q)**: Move to next set of anime without saving
   - **Confirm & Next (E)**: Save selections as watched and proceed
   - **Undo / Previous (R)**: Revert last swipe action or go to previous page

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Q` | Skip current page |
| `E` | Confirm selections and go to next page |
| `R` | Undo last swipe / go to previous page |
| `Esc` | Close modal/panel |

### Search & Filtering

#### Search Bar
- Type to search anime by title (English or Japanese)
- **Tag Syntax**: Type `$tagname$` and press Enter to add as filter tag
  - Example: `$Romance$` adds "Romance" as a filter tag

#### Filter Panel (Right Sidebar)
Access advanced filters by clicking the filter icon in the navbar:

1. **Minimum Rating**: Slider from 0-10
2. **Year Range**: Start and end year inputs
3. **Tags**: Add/remove filter tags (synced with navbar)
4. **Watch Status**:
   - All: Show all anime
   - Watched: Only show marked as watched
   - Unwatched: Only show not yet watched
   - Interested: Only show marked as "want to watch"

### Info Modal

Click the (i) button on any card to open the detailed info modal:
- Full poster image
- Title (English and Japanese)
- Score, episodes, year
- Tags/genres
- Full synopsis
- **"Add to Want to Watch" button**

## Component Architecture

\`\`\`
app/
├── page.tsx              # Main entry point, global state management
├── layout.tsx            # Root layout with fonts
└── globals.css           # Global styles and design tokens

components/
├── anime-grid.tsx        # Main grid container and filtering logic
├── anime-card.tsx        # Individual draggable card with swipe
├── navbar.tsx            # Top navigation bar with search/filters
├── filter-panel.tsx      # Slide-in filter drawer (right side)
├── info-modal.tsx        # Anime details popup with actions
└── keyboard-guide.tsx    # Floating shortcut reference (bottom-right)

docs/
└── README.md             # This documentation file
\`\`\`

## State Management

### Page-Level State (app/page.tsx)

\`\`\`typescript
// Current page number
const [page, setPage] = useState(1)

// IDs of anime confirmed as watched
const [watchedAnime, setWatchedAnime] = useState<number[]>([])

// IDs marked as "want to watch" via swipe right or modal
const [interestedAnime, setInterestedAnime] = useState<number[]>([])
\`\`\`

### Grid-Level State (anime-grid.tsx)

\`\`\`typescript
// Currently selected cards on this page
const [selectedIds, setSelectedIds] = useState<number[]>([])

// Array mapping grid positions to anime IDs
const [gridPositions, setGridPositions] = useState<number[]>([])

// Anime swiped left (for replacement pool tracking)
const [skippedIds, setSkippedIds] = useState<number[]>([])

// History stack for undo functionality
const [history, setHistory] = useState<HistoryEntry[]>([])

// Filter configuration
const [filters, setFilters] = useState<FilterConfig>({...})
\`\`\`

## Card Replacement Logic

When a card is swiped:
1. The card animates off screen in swipe direction
2. A history entry is recorded for undo
3. The system finds the next available anime not in use
4. The new anime replaces the old one at the **SAME grid position**
5. Other cards remain stationary (no shifting)

\`\`\`typescript
// Example: Swipe card at position 3
// Before: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
// After:  [1, 2, 3, 11, 5, 6, 7, 8, 9, 10]
//                    ^^ new anime at same position
\`\`\`

## Backend Integration Guide

### Data Types

\`\`\`typescript
// Anime data structure - match your API response
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

// Filter configuration for API queries
interface FilterConfig {
  minRating: number
  yearStart: number | null
  yearEnd: number | null
  watchStatus: "all" | "watched" | "unwatched" | "interested"
}
\`\`\`

### Replace Demo Data

In `components/anime-grid.tsx`, replace `DEMO_ANIME_DATA` with your API:

\`\`\`typescript
// Option 1: Server Component with fetch
export async function getAnimeList(page: number, filters: FilterConfig) {
  const params = new URLSearchParams({
    page: String(page),
    minRating: String(filters.minRating),
    // ... other filters
  })
  
  const res = await fetch(`/api/anime?${params}`)
  return res.json() as Promise<AnimeData[]>
}

// Option 2: Client-side with SWR
import useSWR from 'swr'

const { data, error, isLoading } = useSWR(
  `/api/anime?page=${page}&...`,
  fetcher
)
\`\`\`

### User Actions API

\`\`\`typescript
// Mark anime as watched
POST /api/user/watched
Body: { animeIds: number[] }

// Mark anime as interested
POST /api/user/interested
Body: { animeId: number }

// Get user's watched/interested lists
GET /api/user/lists
Response: { watched: number[], interested: number[] }
\`\`\`

## Design System

### Colors (CSS Variables)

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | #7c9a8a | Selections, CTAs, primary actions |
| `--secondary` | #d4a574 | Star ratings, accents |
| `--destructive` | #d4847c | Skip indicators, remove actions |
| `--background` | #faf9f7 | Page background |
| `--card` | #ffffff | Card surfaces |
| `--muted` | #f3f1ee | Subtle backgrounds, disabled |
| `--foreground` | #2d2d2d | Primary text |
| `--muted-foreground` | #6b6b6b | Secondary text |

### Typography
- **Font**: Geist (sans-serif)
- **Headings**: Semi-bold to bold
- **Body**: Regular weight

### Spacing
- Card gap: 16-20px (`gap-4` / `gap-5`)
- Container padding: 16-24px (`px-4` / `px-6`)
- Border radius: 12-16px (`rounded-xl` / `rounded-2xl`)

## Accessibility

- All interactive elements are keyboard accessible
- Cards have proper focus states
- Screen reader text for icon-only buttons
- Sufficient color contrast ratios
- Escape key closes modals/panels

## Performance Considerations

- Images use lazy loading via browser default
- Animations use Framer Motion's hardware-accelerated transforms
- Grid positions tracked by ID to minimize re-renders
- Filter computations memoized with `useMemo`
- Callbacks memoized with `useCallback`
