import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useStory } from '../film/films'
import { useFilm } from '../film/state'
import { AWAY_TELLS, awaySummary, currentSlot, farm, stepsBusy, useFarm } from '../farm/state'
import { useCalendarDay } from '../farm/useDaily'
import { useHome } from '../store'
import { cardShowing, cardTurn, mayOpen, newVisit, stepsEndedThisVisit, subscribeCards } from './cardQueue'

// Nothing is over the game: you are playing, on a map that is in view (no curtain, no drive), and there is no panel, no
// screen, no settings, no edit or decorate mode, no film or story film, no card that opened by itself (./cardQueue.ts:
// "Unlocked!" too, which is not a panel), and no welcome-back card waiting to open. What comes by itself waits for it:
// the cards that open by themselves (a toast too: `toast`), and a new farm's next step.

type Home = ReturnType<typeof useHome.getState>

/** Something of the game's own is over it (`toast`: a word at the top counts too). */
const over = (s: Home, toast: boolean) => s.phase !== 'playing' || !s.mapReady || s.curtain || !!(s.panel || s.editing || s.decorating || s.screen || s.settingsOpen || (toast && s.toast))

/** Nothing is over the game and no card shows: the cards' own question (the welcome back waiting is one of them). */
const clearForCards = ({ toast = false } = {}) => !over(useHome.getState(), toast) && useFilm.getState().on === null && useStory.getState().on === null && cardShowing() === null

/** The welcome back waits to open: it comes first, and holds back what comes by itself. */
const welcomeWaits = () => awaySummary() !== null && mayOpen('away')

/** Whether nothing is over the game now (`toast`: a word at the top counts too). For a check a moment later. */
export function gameFree({ toast = false } = {}) {
  return clearForCards({ toast }) && !welcomeWaits()
}

/** Follows the cards, the farm (the welcome back's report) and the game's state. */
const followCards = (f: () => void) => {
  const off = [subscribeCards(f), useFarm.subscribe(f), useHome.subscribe(f)]
  return () => off.forEach((o) => o())
}
const noCard = () => cardShowing() === null

/** Whether nothing is over the game but, maybe, the welcome back still to open; kept as it changes. */
function useClearForCards({ toast = false } = {}) {
  const playing = useHome((s) => s.phase === 'playing' && s.mapReady && !s.curtain)
  const busy = useHome((s) => !!(s.panel || s.editing || s.decorating || s.screen || s.settingsOpen || (toast && s.toast)))
  const film = useFilm((s) => s.on !== null)
  const story = useStory((s) => s.on !== null)
  const none = useSyncExternalStore(followCards, noCard)
  return playing && !busy && !film && !story && none
}

/** Whether nothing is over the game, kept as it changes (`toast`: a word at the top counts too). */
export function useGameFree({ toast = false } = {}) {
  const clear = useClearForCards({ toast })
  const waits = useSyncExternalStore(followCards, welcomeWaits)
  return clear && !waits
}

/** How long the game is free, with nothing over it, before a card opens by itself (ms): the world first, then the card. */
const BEAT_MS = 900

/** A visit begins (./cardQueue.ts, `newVisit`): as the page is shown again after AWAY_TELLS or more hidden, as a time
 *  away is told (the farm's report: the page closed or asleep that long), as the day changes while the game is open (a
 *  new day's gift), and on another farm (another slot, or one started again: its XP fell, as it never does in play). And
 *  a new farm's first steps ending in this visit is noted (`stepsEndedThisVisit`). */
function useVisits() {
  const day = useCalendarDay()
  const seenDay = useRef(day)
  useEffect(() => {
    if (day === seenDay.current) return
    seenDay.current = day
    newVisit()
  }, [day])
  useEffect(() => {
    let hiddenAt: number | null = null
    const shown = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now()
      else if (hiddenAt !== null) {
        if (Date.now() - hiddenAt >= AWAY_TELLS * 1000) newVisit()
        hiddenAt = null
      }
    }
    document.addEventListener('visibilitychange', shown)
    let report = awaySummary()
    let slot = currentSlot()
    let points = farm.xp.points
    let running = stepsBusy()
    const off = useFarm.subscribe(() => {
      const r = awaySummary()
      const s = currentSlot()
      const p = farm.xp.points
      if ((r && r !== report) || s !== slot || p < points) newVisit()
      report = r
      slot = s
      points = p
      const now = stepsBusy()
      if (running && !now && farm.firstSteps.over) stepsEndedThisVisit()
      running = now
    })
    return () => {
      document.removeEventListener('visibilitychange', shown)
      off()
    }
  }, [])
}

/** Opens the cards that open by themselves (./cardQueue.ts), one at a time: once the game has been free a beat (a toast
 *  counted, the welcome back waiting not: it is the first of them), the next due in order, within the visit's budget. */
export function CardWatcher() {
  const free = useClearForCards({ toast: true })
  useVisits()
  useEffect(() => {
    if (!free) return
    // (looked at again each beat while free: a card comes due as the farm changes, the day turns, a level is reached)
    const t = window.setInterval(() => {
      if (clearForCards({ toast: true })) cardTurn(true)
    }, BEAT_MS)
    return () => window.clearInterval(t)
  }, [free])
  return null
}
