import { useEffect } from 'react'
import { farmSound } from '../audio/sound'
import { useHome } from '../store'
import { registerCard } from '../ui/cardQueue'
import { DailyCard } from './DailyCard'
import { claimDaily, dailyDue, dailyNow, offerDaily, useFarm } from './state'
import { useCalendarDay } from './useDaily'

// The daily gift (src/farm/daily.ts): its card reads the farm (how it looks: ./DailyCard.tsx), and it is one of the
// cards that open by themselves (src/ui/cardQueue.ts): once a day, the first time the farm is in view that day with
// nothing over it — on the farm or in the house, a beat after it appears, after the welcome-back card, never over the
// opening menu, a film, the drive, another panel (the farm news) or a word at the top (a toast: the news's "Gift day is
// on" as play starts, or as an event begins at midnight with the new day) — and only within the visit's budget, not in
// the visit a new farm's first steps end in. A day changing while the game is open brings the new day's gift. Closed
// without claiming, or not opened by itself, it waits in the menu in the corner (src/ui/HudMode.tsx) until the day is
// over.

export function DailyPanel() {
  useFarm((s) => s.rev)
  // (the day followed too: the card's clock running out brings the new day's gift onto it)
  useCalendarDay()
  const close = useHome((s) => s.closePanel)
  return <DailyCard v={dailyNow()} onClaim={claimDaily} onClose={close} onReveal={() => farmSound('surprise')} />
}

/** The day's gift on the card queue: due while it waits and has not opened by itself today (`dailyDue`); it opens as
 *  its card, kept in the save as offered today. */
export function DailyWatcher() {
  useEffect(
    () =>
      registerCard('daily', {
        due: dailyDue,
        open: () => {
          offerDaily()
          useHome.getState().openPanel({ kind: 'daily' })
        },
        showing: () => useHome.getState().panel?.kind === 'daily',
      }),
    [],
  )
  return null
}
