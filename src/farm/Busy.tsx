import { useEffect, useState, useSyncExternalStore } from 'react'
import { debugSet } from '../lib/debug'
import { clock, readyAt } from '../lib/time'
import { art } from '../ui/art'
import { useCallsRest } from '../ui/calls'
import { cardShowing, subscribeCards, visitNow } from '../ui/cardQueue'
import { TopSlot } from '../ui/TopStack'
import { useGameFree } from '../ui/useGameFree'
import { appointments, busyWords, farmBusy, type Appointment } from './appointments'
import { produceById } from './data'
import { iconUrl } from './icons'
import { eventSpeed, farm, machineLock, stepsBusy, useFarm } from './state'
import './Busy.css'

// The busy card (update-v1/missions/01-loop-economy.md, change 6; JOURNEY.md fix 9; CONTRACTS §1.17): the moment the
// farm becomes busy — every bed sown, every open machine at work — a small card at the top says until when ("Busy till
// 07:40"), with the soonest thing and the longest: a clean end to a visit, the time away shown as rest, never "All set"
// (that is the first steps' end). Once a visit, only with no card up, never counted among the cards that open by
// themselves (its own top slot, `busy`), no confetti; while it shows, nothing at the top calls (src/ui/calls.ts). The
// corner menu says "Next ready 0:40" while the farm is busy (NextReady).

/** How long the card stays (ms). */
export const BUSY_SHOWS = 4000

/** The speeds the week's events give now (a festival's crops, a rush's machines). */
const speeds = () => ({ crops: eventSpeed('crops'), machines: eventSpeed('machines') })

/** The farm is busy now: every bed it owns sown, every machine open at its level at work. */
export const busyNow = () => farmBusy(farm, (id) => machineLock(id) === null)

/** When something ready will be: a countdown under an hour (0:40), the device's clock past it (21:40). */
export const whenReady = (seconds: number, now = Date.now()) => (seconds < 3600 ? clock(seconds) : readyAt(seconds, now))

/** What the card says now, or null with nothing on its way. */
export const busyCardWords = (now = Date.now()) => busyWords(farm, now, speeds())

/** The soonest thing on its way that is a good (the corner menu's line), or null. */
export const nextReady = (): Appointment | null => appointments(farm, speeds()).find((a) => 'item' in a.what) ?? null

/** Busy at the last look (kept beyond the card: the corner menu, its home, comes and goes as panels open); a turn to
 *  busy waits to be shown until the game is free; the visit it last showed in (src/ui/cardQueue.ts's: once a visit). */
let lastBusy = false
let pending = false
let shownIn: object | null = null
/** ?debug: show it now (22-xp measures it in the column), whatever the farm; or let it show again in this visit (a
 *  spec on the shared page, whose visit may have shown it already). */
let forced = 0
const listeners = new Set<() => void>()
export const busyHooks = {
  show() {
    forced++
    listeners.forEach((f) => f())
  },
  forget() {
    shownIn = null
  },
  busy: () => busyNow(),
}
debugSet('busy', busyHooks)

/** The busy card in its top slot: it shows for BUSY_SHOWS as the farm turns busy, once a visit, with no card up. */
export function BusyCard() {
  useFarm((s) => s.rev)
  const free = useGameFree({ toast: true })
  const none = useSyncExternalStore(subscribeCards, () => cardShowing() === null)
  const force = useSyncExternalStore(
    (f) => {
      listeners.add(f)
      return () => listeners.delete(f)
    },
    () => forced,
  )
  const [words, setWords] = useState<ReturnType<typeof busyCardWords>>(null)
  const busy = busyNow()

  // the farm turned busy (since the last look, here or before the menu was last on the screen): it waits to be shown
  useEffect(() => {
    if (busy && !lastBusy) pending = true
    if (!busy) pending = false
    lastBusy = busy
  }, [busy])

  // shown once the game is free, with no card up (and not while a new farm's first steps run)
  useEffect(() => {
    if (!pending || !free || !none || words || stepsBusy()) return
    pending = false
    if (shownIn === visitNow()) return
    shownIn = visitNow()
    setWords(busyCardWords())
  }, [busy, free, none, words])

  useEffect(() => {
    if (force) setWords(busyCardWords() ?? { title: 'Busy till tomorrow 07:40', soonest: SAMPLE.soonest, longest: SAMPLE.longest, until: '07:40', night: true })
  }, [force])

  useEffect(() => {
    if (!words) return
    const t = window.setTimeout(() => setWords(null), BUSY_SHOWS)
    return () => window.clearTimeout(t)
  }, [words])

  useCallsRest(words !== null)
  if (!words) return null
  const pic = (a: Appointment) => ('item' in a.what ? iconUrl(a.what.item) : art(a.what.art))
  const name = (a: Appointment) => ('item' in a.what ? produceById(a.what.item).plural : '')
  return (
    <TopSlot name="busy">
      <div className="busy-card" role="status" aria-label={`${words.title}: ${name(words.soonest)} first, ${whenReady(words.soonest.ready)}`}>
        <img className="art busy-card-art" src={art('hourglass-done')} alt="" draggable={false} />
        <span className="busy-card-title">
          Busy till {words.night && <img className="busy-card-moon" src={art('crescent-moon')} alt="tomorrow" draggable={false} />}
          {words.until}
        </span>
        {/* the soonest with its time; the longest with its picture (its time is the title's) */}
        <span className="busy-card-when">
          <img src={pic(words.soonest)} alt="" draggable={false} />
          {whenReady(words.soonest.ready)}
        </span>
        {words.longest !== words.soonest && (
          <span className="busy-card-when last">
            <img src={pic(words.longest)} alt={name(words.longest)} draggable={false} />
          </span>
        )}
      </div>
    </TopSlot>
  )
}

/** What the card shows when shown by hand on a farm with nothing on its way (?debug, 22-xp). */
const SAMPLE = {
  soonest: { what: { item: 'egg' as const }, ready: 40, count: 1, worth: 2, from: 'producer' as const },
  longest: { what: { item: 'cotton' as const }, ready: 8 * 3600, count: 2, worth: 134, from: 'bed' as const },
}

/** The corner menu's line while the farm is busy: "Next ready 0:40", with the good's picture. Not a button. */
export function useNextReady(): Appointment | null {
  useFarm((s) => s.rev)
  return busyNow() ? nextReady() : null
}
