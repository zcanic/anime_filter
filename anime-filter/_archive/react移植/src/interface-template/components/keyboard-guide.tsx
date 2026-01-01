"use client"

/**
 * KeyboardGuide Component
 *
 * A floating guide in the bottom-right corner showing available
 * keyboard shortcuts for the anime selection interface.
 *
 * @description Shortcuts:
 * - Q: Skip the current page (no selections saved)
 * - E: Confirm current selections and go to next page
 * - R: Undo last action / go to previous page
 */

export function KeyboardGuide() {
  return (
    <div className="fixed bottom-6 right-6 bg-card/95 backdrop-blur-sm rounded-xl shadow-lg px-4 py-3 z-30 border border-border/30">
      <div className="flex flex-col gap-2 text-xs">
        {/* Skip shortcut */}
        <div className="flex items-center gap-3">
          <kbd className="px-2 py-1 rounded-lg bg-muted text-foreground font-mono font-bold min-w-[28px] text-center">
            Q
          </kbd>
          <span className="text-muted-foreground">Skip page</span>
        </div>
        {/* Confirm shortcut */}
        <div className="flex items-center gap-3">
          <kbd className="px-2 py-1 rounded-lg bg-muted text-foreground font-mono font-bold min-w-[28px] text-center">
            E
          </kbd>
          <span className="text-muted-foreground">Confirm & next</span>
        </div>
        <div className="flex items-center gap-3">
          <kbd className="px-2 py-1 rounded-lg bg-muted text-foreground font-mono font-bold min-w-[28px] text-center">
            R
          </kbd>
          <span className="text-muted-foreground">Undo / Previous</span>
        </div>
      </div>
    </div>
  )
}
