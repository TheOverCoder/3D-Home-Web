import { useEffect, useReducer, useState } from 'react'
import { farmSound, uiClick } from '../../audio/sound'
import { debugSet } from '../../lib/debug'
import { haptic } from '../../lib/device'
import { useHome } from '../../store'
import { EVENTS, speedAt, type Boost } from '../events'
import { drawLucky, eventTime, eventsNow, farm, luckyPool, newsBadge, roadNow, sawNews, seasonNews, setEventClock, useFarm } from '../state'
import { NewsCard } from './NewsCard'
import { newsView } from './view'

// The farm news as the game opens it (the corner menu's "Farm news", src/ui/HudMode.tsx): it reads the farm's events
// and draws; how it looks is ./NewsCard.tsx. And the watcher that keeps the news's badge true as events begin and end in
// play, and says once a visit when one has begun that the news has not shown.

/** The farm news: what is on and coming now, the lucky draw, and the season road ("This season"); opened, what is on
 *  counts as shown. */
export function NewsPanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  // what it had shown as it opened: what is new stays marked new while it is open
  const [seenBefore] = useState(() => farm.events.seen)
  useEffect(() => sawNews(), [])
  // the time left goes on while it is open
  const [, again] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    const t = window.setInterval(again, 30_000)
    return () => window.clearInterval(t)
  }, [])
  const v = newsView(eventTime(), farm.events, luckyPool(), seenBefore, seasonNews())
  return (
    <NewsCard
      v={v}
      road={roadNow()}
      onDraw={drawLucky}
      onClose={close}
      onLand={() => {
        haptic('tick')
        uiClick()
      }}
      onReveal={() => farmSound('surprise')}
    />
  )
}

/** How often play looks whether an event has begun or ended (its edges are on the hour). */
const LOOK_MS = 10_000

/** Events beginning and ending in play: the news's badge follows, and an event that begins (or is on as play starts)
 *  and has not been shown is told once a visit, in a toast. */
export function NewsWatcher() {
  useEffect(() => {
    let last = ''
    const told = new Set<string>()
    const look = () => {
      const on = eventsNow()
      const keys = on.map((o) => o.key).join(',')
      if (keys !== last) {
        last = keys
        useFarm.setState((s) => ({ rev: s.rev + 1 }))
      }
      for (const o of on) {
        if (told.has(o.key) || farm.events.seen.includes(o.key)) continue
        told.add(o.key)
        const e = EVENTS[o.id]
        useHome.getState().showToast(`${e.name} is on · see the farm news`, e.art)
      }
    }
    look()
    const t = window.setInterval(look, LOOK_MS)
    // (?debug: the tests set the events' clock, draw, and read what the news would show)
    debugSet('events', {
      set: setEventClock,
      time: eventTime,
      now: eventsNow,
      draw: drawLucky,
      saw: sawNews,
      badge: newsBadge,
      record: () => farm.events,
      pool: luckyPool,
      speed: (b: Boost) => speedAt(b, eventTime()),
      view: () => newsView(eventTime(), farm.events, luckyPool()),
    })
    return () => window.clearInterval(t)
  }, [])
  return null
}
