import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { farmSound } from '../audio/sound'
import { flyCoins } from '../fx/coins'
import { coinsToFly, reducedMotion } from '../fx/fx'
import { onXpFlight, xpInFlight } from '../fx/xp'
import { art } from '../ui/art'
import { claimLevel, farm, useFarm, xpEventCount, xpNow } from './state'
import { levelOf, unpaidCoins, xpAt } from './xp'

// The level chip in the row at the top (role G): a star with the level on it, a thin bar along the bottom of the row
// that fills with XP as the crystals land (src/fx/xp.ts), a pulse of the star as it grows, and the coins of the levels
// reached waiting to be claimed with a tap. LevelUp is the show of a new level (a flash, a ring, the new number),
// started by play only (xpEventCount in state.ts): a farm loaded or switched to takes its level without a show.

/** The XP as the bar shows it: all the points, what is still in the air, and the count of gains from play. */
interface Seen {
  points: number
  flying: number
  events: number
}
const read = (): Seen => ({ points: xpNow().points, flying: xpInFlight(), events: xpEventCount() })

/**
 * The XP as the bar shows it, read a frame after anything changed. A gain's crystals take off in the frame after it
 * (src/fx/FarmFx.tsx), so reading at once would show the gain on the bar, then take it back as they fly; a frame
 * later they are in the air and held back from it. Crystals taking off or landing are read the same way.
 */
function useSeenXp(): Seen {
  const rev = useFarm((s) => s.rev)
  const [seen, setSeen] = useState(read)
  const ask = useRef(() => {})
  useEffect(() => {
    let frame = 0
    const later = () => {
      // one read for the frame, however many changes asked for it (never put off: the farm may change every frame)
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0
          const now = read()
          setSeen((s) => (s.points === now.points && s.flying === now.flying && s.events === now.events ? s : now))
        })
    }
    ask.current = later
    const off = onXpFlight(later)
    later()
    return () => {
      off()
      cancelAnimationFrame(frame)
      ask.current = () => {}
    }
  }, [])
  useEffect(() => ask.current(), [rev])
  return seen
}

const FILL_MS = 300
const PULSE_MS = 260

/** The bar grows to `k` of the level in FILL_MS with a light sweeping along it; past a level, it fills to the end
 *  first and starts the next one from empty. From where it is now, if it was still on its way. */
function grow(fill: HTMLElement | null, shine: HTMLElement | null, from: { level: number; k: number }, level: number, k: number) {
  const width = fill?.parentElement?.clientWidth ?? 0
  if (!fill || !width || typeof fill.animate !== 'function') return
  const running = fill.getAnimations?.() ?? []
  const now = running.length ? fill.offsetWidth / width : from.k
  for (const a of running) a.cancel()
  const pct = (v: number) => `${Math.max(0, Math.min(1, v)) * 100}%`
  const frames: Keyframe[] = level > from.level ? [{ width: pct(now) }, { width: '100%', offset: 0.45 }, { width: '0%', offset: 0.46 }, { width: pct(k) }] : [{ width: pct(now) }, { width: pct(k) }]
  fill.animate(frames, { duration: FILL_MS, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' })
  shine?.animate(
    [
      { transform: 'translateX(-100%)', opacity: 0 },
      { opacity: 1, offset: 0.3 },
      { transform: 'translateX(260%)', opacity: 0 },
    ],
    { duration: FILL_MS + 80, easing: 'ease-out' },
  )
}

/** The star grows a little, brightens and comes back (in reduced motion it only brightens). */
function pulse(el: HTMLElement | null) {
  if (!el || typeof el.animate !== 'function') return
  const still = reducedMotion()
  el.animate(
    [
      { transform: 'scale(1)', filter: 'brightness(1)' },
      { transform: still ? 'scale(1)' : 'scale(1.12)', filter: 'brightness(1.35)', offset: 0.4 },
      { transform: 'scale(1)', filter: 'brightness(1)' },
    ],
    { duration: PULSE_MS, easing: 'ease-out' },
  )
}

/** The level and its bar, inside `.farm-chip`: the bar is the row's last item, along its bottom. */
export function XpChip() {
  useFarm((s) => s.rev)
  const seen = useSeenXp()
  const shown = Math.max(0, seen.points - seen.flying)
  const level = levelOf(shown)
  const need = xpAt(level + 1) - xpAt(level)
  const into = shown - xpAt(level)
  const k = Math.min(1, into / need)
  // the coins of the levels the bar has reached (a level's crystals still in the air are not paid for yet)
  const unpaid = unpaidCoins({ points: shown, paid: farm.xp.paid })
  const star = useRef<HTMLSpanElement>(null)
  const fill = useRef<HTMLSpanElement>(null)
  const shine = useRef<HTMLSpanElement>(null)
  const before = useRef({ seen, shown, level, k })

  // XP from play joins the bar: it grows with a sweep of light, the star pulses, and it rings. A farm loaded or
  // switched to (its points changed with no gain and nothing landing) is simply shown as it is.
  useLayoutEffect(() => {
    const b = before.current
    before.current = { seen, shown, level, k }
    if (shown <= b.shown || (seen.events === b.seen.events && seen.flying >= b.seen.flying)) return
    if (!reducedMotion()) grow(fill.current, shine.current, b, level, k)
    pulse(star.current)
    farmSound('xp')
  }, [seen, shown, level, k])

  // pays the levels the bar shows, never one whose crystals are still in the air: the coins paid are the coins shown
  const claim = (chip: HTMLElement) => {
    const coin = chip.querySelector('.xp-coin')?.getBoundingClientRect()
    // the levels the bar shows (crystals still in the air are not paid for yet)
    const coins = claimLevel(level)
    if (coins > 0 && coin && !reducedMotion()) flyCoins(coin.left + coin.width / 2, coin.top + coin.height / 2, coinsToFly(coins))
  }

  const badge = (
    <span className="xp-star" ref={star}>
      <img src={art('glowing-star')} alt="" />
      <b>{level}</b>
    </span>
  )
  // the badge and its bar on one line, the bar taking what the line has left (a phone's narrow row: one line, not two)
  return (
    <span className="xp-line">
      {unpaid > 0 ? (
        <button className="farm-chip-item level ready" onClick={(e) => claim(e.currentTarget)} title={`Level ${level}: ${unpaid} coins to claim`} aria-label={`Level ${level}: claim ${unpaid} coins`}>
          {badge}
          <img className="xp-coin" src={art('coin')} alt="" />
          <b>{unpaid}</b>
        </button>
      ) : (
        <span className="farm-chip-item level" title={`Level ${level}: ${into} of ${need} XP to level ${level + 1}`}>
          {badge}
        </span>
      )}
      <div className="xp-bar" role="progressbar" aria-label={`Level ${level}: XP to level ${level + 1}`} aria-valuemin={0} aria-valuemax={need} aria-valuenow={into}>
        <span className="xp-bar-fill" ref={fill} style={{ width: `${k * 100}%` }}>
          <span className="xp-bar-shine" ref={shine} />
        </span>
      </div>
    </span>
  )
}

/** The show of a new level, over the scene under the compass (no pointer events, never a panel or a toast): a flash,
 *  a ring of energy and the new number, once the crystals that reached it have landed on the bar. */
export function LevelUp() {
  const seen = useSeenXp()
  const reached = levelOf(seen.points)
  const landed = levelOf(Math.max(0, seen.points - seen.flying))
  const told = useRef({ events: seen.events, level: reached, pending: false })
  const [show, setShow] = useState<{ level: number; n: number } | null>(null)

  useEffect(() => {
    const s = told.current
    if (seen.events !== s.events) {
      s.events = seen.events
      if (reached > s.level) s.pending = true
    } else if (!s.pending || reached < s.level) {
      // the farm changed with no gain from play (loaded, another farm, a fresh start): its level is taken, no show
      s.level = reached
      s.pending = false
    }
    if (s.pending && landed > s.level) {
      s.level = landed
      s.pending = landed < reached
      setShow((p) => ({ level: landed, n: (p?.n ?? 0) + 1 }))
      farmSound('level')
    }
  }, [seen, reached, landed])

  useEffect(() => {
    if (!show) return
    const t = window.setTimeout(() => setShow(null), 2400)
    return () => window.clearTimeout(t)
  }, [show])

  // under the compass, and below the toast when one shows (one often comes with the gain): never over its words
  const box = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const top = el.parentElement?.getBoundingClientRect().top ?? 0
    const toast = document.querySelector('.toast')?.getBoundingClientRect()
    const below = toast && toast.height > 0 ? toast.bottom + 6 - top : 0
    el.style.top = `${Math.max(0, Math.min(below, innerHeight - 8 - el.offsetHeight - top))}px`
  }, [show])

  return (
    <div className="level-up" aria-live="polite">
      {show && (
        <div className="level-up-show" key={show.n} ref={box}>
          <span className="level-up-flash" aria-hidden="true" />
          <span className="level-up-ring" aria-hidden="true" />
          <span className="level-up-ring late" aria-hidden="true" />
          <span className="level-up-word">Level</span>
          <b className="level-up-number">{show.level}</b>
        </div>
      )}
    </div>
  )
}
