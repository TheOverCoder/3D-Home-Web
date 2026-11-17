import { useEffect } from 'react'
import { farmSound } from '../audio/sound'
import { useHome } from '../store'
import { gameFree, useGameFree } from '../ui/useGameFree'
import { DailyCard } from './DailyCard'
import { claimDaily, currentSlot, dailyDue, dailyNow, offerDaily, useFarm } from './state'
import { useCalendarDay } from './useDaily'

// The daily gift (src/farm/daily.ts): its card reads the farm (how it looks: ./DailyCard.tsx), and the watcher opens it
// by itself once a day — the first time the farm is in view that day, on the farm or in the house, a beat after it
// appears, and never over the opening menu, a film, the drive, the welcome-back card, another panel (the farm news) or a
// word at the top (a toast: the news's "Gift day is on" as play starts, or as an event begins at midnight with the new
// day): it waits for them, and comes after. A day changing while the game is open brings the new day's gift. Closed
// without claiming, it waits in the menu in the corner (src/ui/HudMode.tsx) until the day is over.

export function DailyPanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  return <DailyCard v={dailyNow()} onClaim={claimDaily} onClose={close} onReveal={() => farmSound('surprise')} />
}

/** How long the farm is in view, with nothing over it, before the day's gift comes in by itself (ms): the world first,
 *  then the gift. */
const BEAT_MS = 900

/** The farm and the day the watcher last decided for (this visit): once each, whether it opened the card or not (a
 *  farm that had not begun yet, or its gift taken). */
let decided = ''

export function DailyWatcher() {
  // (nothing over the game: src/ui/useGameFree.ts; a toast too)
  const free = useGameFree({ toast: true })
  const slot = useFarm(() => currentSlot())
  const day = useCalendarDay()
  useEffect(() => {
    const key = `${slot}:${day}`
    if (!free || decided === key) return
    const t = window.setTimeout(() => {
      // (still nothing over the game: a panel may have opened in the same moment)
      if (!gameFree({ toast: true })) return
      decided = key
      if (!dailyDue()) return
      offerDaily()
      useHome.getState().openPanel({ kind: 'daily' })
    }, BEAT_MS)
    return () => window.clearTimeout(t)
  }, [free, slot, day])
  return null
}
