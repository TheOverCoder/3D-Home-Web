import { useSyncExternalStore } from 'react'
import { calendarDay, dailyWaiting, useFarm } from './state'

// The daily gift as the interface follows it: the calendar's day (asked again every few seconds, as the page is shown
// again and whenever the farm changes, so a day changing while the game is open is seen within seconds) and whether
// today's gift waits (the menu in the corner shows it: src/ui/HudMode.tsx).

/** How often the day is asked again while nothing else changes (ms). */
const EVERY = 15_000

function subscribe(changed: () => void) {
  const id = window.setInterval(changed, EVERY)
  const seen = () => document.visibilityState === 'visible' && changed()
  document.addEventListener('visibilitychange', seen)
  window.addEventListener('focus', changed)
  const off = useFarm.subscribe(changed)
  return () => {
    window.clearInterval(id)
    document.removeEventListener('visibilitychange', seen)
    window.removeEventListener('focus', changed)
    off()
  }
}

/** Today on the device's calendar, followed. */
export const useCalendarDay = () => useSyncExternalStore(subscribe, calendarDay)

/** Whether today's gift waits for the player (src/farm/state.ts, dailyWaiting), followed. */
export const useDailyWaiting = () => useSyncExternalStore(subscribe, dailyWaiting)
