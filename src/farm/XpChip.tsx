import { m, useReducedMotion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { farmSound } from '../audio/sound'
import { coinsToFly, reducedMotion } from '../fx/fx'
import { onXpFlight, xpInFlight } from '../fx/xp'
import { GarmentPic } from '../ui/GarmentPic'
import { flyCoins, flyItem } from '../fx/coins'
import { storeOf } from './data'
import { iconUrl } from './icons'
import { useHome } from '../store'
import { art } from '../ui/art'
import { SPRING } from '../ui/motion'
import { TopSlot } from '../ui/TopStack'
import { levelView } from './levelView'
import { GARMENTS, type Garment } from './outfit'
import { farm, opensOn, useFarm, xpEventCount, xpNow } from './state'
import { levelOf } from './xp'
import { waitingBoxes } from './gifts'
import { openedBetween, type UnlockId } from './unlocks'
import { Unlocked } from './Unlocked'
import { useGameFree } from '../ui/useGameFree'

// The level chip at the top (src/farm/TopDash.tsx): a road from a star with the level on it to the next level and its
// prize, its bar filling with XP as the crystals land (src/fx/xp.ts), a pulse of the star as it grows, and the gift
// boxes waiting to be opened (src/farm/gifts.ts: the chip glows, with how many at the road's end). A tap opens the
// level's card (./LevelPanel.tsx): the XP to the next level, its gift boxes, what it brings. LevelUp is the show of a
// new level (a flash, a ring, the new number; what the level brought by itself — its coins and its gift — flying off it
// to the coin chip and the silo's or the barn's tank), every fifth level of the garment it brings for the wardrobe,
// and then of what it opened ("Unlocked!", ./Unlocked.tsx, once nothing is over the game); started by play only
// (xpEventCount in state.ts): a farm loaded or switched to takes its level without a show.

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

/** The coins of the levels reached by play whose crystals have not landed on the bar yet (read a frame late, as the bar
 *  is: from the gain until they land). The level-up show flies them to the coin chip once they have
 *  (LevelUp, GIFT_FLY_MS after), so the chip (./TopDash.tsx) counts them in as they arrive, not before. */
export function useLevelCoinsInAir(): number {
  const seen = useSeenXp()
  const landed = levelOf(Math.max(0, seen.points - seen.flying))
  return farm.gifts.came.reduce((n, c) => (c.level > landed ? n + c.coins : n), 0)
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

/** The bar drawn from empty as the road first shows (the dashboard's opening); later changes grow by `grow`. */
function useFirstFill(fill: { current: HTMLElement | null }) {
  useLayoutEffect(() => {
    const el = fill.current
    if (!el || reducedMotion() || typeof el.animate !== 'function') return
    el.animate([{ width: '0%' }], { duration: 700, delay: 300, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' })
  }, [fill])
}

/** The level as a short road (the design lab's board "top", D): your star with the level on it, the XP still to go
 *  written over a bar that fills as the crystals land — its quarters marked (where the level's gift boxes are), lit
 *  once passed, and its last quarter warm — and at its end the next level with its prize (the garment it brings, or
 *  its coins); the gift boxes reached and not opened, in their place once there are some, the road glowing. A tap
 *  opens the level's card. */
export function XpChip() {
  useFarm((s) => s.rev)
  const seen = useSeenXp()
  const still = useReducedMotion()
  const shown = Math.max(0, seen.points - seen.flying)
  const { level, into, need, top, gift: garment } = levelView(shown, farm.xp.paid)
  const k = Math.min(1, into / need)
  // the gift boxes the bar has reached and not opened (a quarter's crystals still in the air have not reached it yet)
  const gifts = waitingBoxes(farm.gifts, shown).length
  const star = useRef<HTMLSpanElement>(null)
  const fill = useRef<HTMLSpanElement>(null)
  const shine = useRef<HTMLSpanElement>(null)
  const before = useRef({ seen, shown, level, k })
  useFirstFill(fill)

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

  const open = () => useHome.getState().openPanel({ kind: 'level' })
  // the last quarter of a level: the road warms and the prize at its end wiggles now and then (the goal gradient)
  const near = !top && k >= 0.75
  const togo = need - into
  const boxes = `${gifts} ${gifts === 1 ? 'gift' : 'gifts'} to open`
  return (
    <m.span className="xp-line" initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.pop, delay: 0.1 }}>
      <button
        className={`farm-chip-item level top-road${gifts ? ' ready' : ''}${near ? ' near' : ''}`}
        onClick={open}
        title={gifts ? `Level ${level}: ${boxes}` : `Level ${level}: ${into} of ${need} XP to level ${level + 1}`}
        aria-label={gifts ? `Level ${level}: ${boxes}` : `Level ${level}: what the next level brings`}
      >
        <span className="xp-star" ref={star}>
          <img src={art('glowing-star')} alt="" />
          <b>{level}</b>
        </span>
        <span className="top-road-way">
          <span className="top-road-togo">{top ? 'Top level' : near ? `Only ${togo} XP!` : `${togo} XP to go`}</span>
          <span className="xp-bar" role="progressbar" aria-label={`Level ${level}: XP to level ${level + 1}`} aria-valuemin={0} aria-valuemax={need} aria-valuenow={into}>
            <span className="xp-bar-fill" ref={fill} style={{ width: `${k * 100}%` }}>
              <span className="top-road-clip">
                <span className="xp-bar-shine" ref={shine} />
              </span>
              <span className="top-road-head" />
            </span>
            {/* the quarters: near goals on the way, each lit once passed */}
            {[0.25, 0.5, 0.75].map((q) => (
              <i key={q} className={`top-road-notch${k >= q ? ' passed' : ''}`} style={{ left: `${q * 100}%` }} />
            ))}
          </span>
        </span>
        {gifts > 0 ? (
          <m.span className="top-road-gifts" initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...SPRING.pop, delay: 0.2 }}>
            <img className="xp-gift" src={art('wrapped-gift')} alt="" />
            {gifts}
          </m.span>
        ) : top ? null : (
          <span className="top-road-next">
            <i>{level + 1}</i>
            <m.span
              className="top-road-prize"
              animate={near && !still ? { rotate: [0, -12, 10, -6, 0], scale: [1, 1.15, 1] } : undefined}
              transition={{ delay: 1.1, duration: 0.6, repeat: Infinity, repeatDelay: 3 }}
            >
              {garment ? <GarmentPic g={garment} /> : <img className="art" src={art('coin')} alt="" />}
            </m.span>
          </span>
        )}
      </button>
    </m.span>
  )
}

/** How long a level's show lasts, and a garment's after it; when the gift the level brought flies off from it. */
const LEVEL_MS = 2400
const GIFT_MS = 3400
export const GIFT_FLY_MS = 650

/** The show of a new level, over the scene under the compass (no pointer events, never a panel or a toast): a flash,
 *  a ring of energy and the new number, once the crystals that reached it have landed on the bar; then, for a level
 *  that brings a garment, the garment: its picture popping out of a burst of light, its name, and that it is in the
 *  wardrobe now. */
export function LevelUp() {
  const seen = useSeenXp()
  const reached = levelOf(seen.points)
  const landed = levelOf(Math.max(0, seen.points - seen.flying))
  const told = useRef({ events: seen.events, level: reached, pending: false })
  const [show, setShow] = useState<{ level: number; from: number; n: number } | null>(null)
  const showEl = useRef<HTMLDivElement>(null)
  // the garments the levels shown brought, still to be shown (one after another)
  const [gifts, setGifts] = useState<Garment[]>([])
  const [gift, setGift] = useState<{ g: Garment; n: number } | null>(null)
  // what the levels shown opened, still to be shown (a reveal for each level, once nothing is over the game)
  const [opened, setOpened] = useState<{ level: number; opens: UnlockId[] }[]>([])
  const [reveal, setReveal] = useState<{ level: number; opens: UnlockId[]; n: number } | null>(null)
  const free = useGameFree()

  useEffect(() => {
    const s = told.current
    if (seen.events !== s.events) {
      s.events = seen.events
      // (a farm gone back below the level shown — started again, or another one — in the same frame as XP from play:
      // its level is taken, as below; the show counts from there)
      if (reached < s.level) {
        s.level = reached
        s.pending = false
      } else if (reached > s.level) s.pending = true
    } else if (!s.pending || reached < s.level) {
      // the farm changed with no gain from play (loaded, another farm, a fresh start): its level is taken, no show
      s.level = reached
      s.pending = false
    }
    if (s.pending && landed > s.level) {
      const from = s.level
      s.level = landed
      s.pending = landed < reached
      setShow((p) => ({ level: landed, from, n: (p?.n ?? 0) + 1 }))
      const brought = GARMENTS.filter((g) => g.level > from && g.level <= landed)
      if (brought.length) setGifts((q) => [...q, ...brought])
      const opens = openedBetween(from, landed, opensOn)
      if (opens.length) setOpened((q) => [...q, ...opens])
      farmSound('level')
    }
  }, [seen, reached, landed])

  useEffect(() => {
    if (!show) return
    const t = window.setTimeout(() => setShow(null), LEVEL_MS)
    // what each level brought by itself flies off the number once it has landed: its coins to the coin chip, its gift
    // up and on to its building's chip (where they went: the level's card tells what they were)
    const came = farm.gifts.came.filter((c) => c.level > show.from && c.level <= show.level)
    const fly = window.setTimeout(() => {
      const el = showEl.current
      if (!el || !el.getClientRects().length || reducedMotion()) return
      const r = el.getBoundingClientRect()
      const x = r.left + r.width / 2
      const y = r.top + r.height * 0.62
      const coins = came.reduce((n, c) => n + c.coins, 0)
      if (coins > 0) flyCoins(x, y, coinsToFly(coins))
      came.forEach((c, k) => 'item' in c.prize && flyItem(x, y, iconUrl(c.prize.item), k, storeOf(c.prize.item)))
    }, GIFT_FLY_MS)
    return () => {
      window.clearTimeout(t)
      window.clearTimeout(fly)
    }
  }, [show])

  // a garment's show once the level's is over, and the next one's after it
  useEffect(() => {
    if (show || gift || !gifts.length) return
    setGift((p) => ({ g: gifts[0], n: (p?.n ?? 0) + 1 }))
    setGifts((q) => q.slice(1))
    farmSound('garment')
  }, [show, gift, gifts])
  useEffect(() => {
    if (!gift) return
    const t = window.setTimeout(() => setGift(null), GIFT_MS)
    return () => window.clearTimeout(t)
  }, [gift])
  // what the level opened, once its show and its garments are over and nothing is over the game (a panel the level was
  // reached in, the edit mode): one reveal after another
  useEffect(() => {
    if (show || gift || gifts.length || reveal || !opened.length || !free) return
    setReveal((p) => ({ ...opened[0], n: (p?.n ?? 0) + 1 }))
    setOpened((q) => q.slice(1))
  }, [show, gift, gifts, reveal, opened, free])

  return (
    <TopSlot name="level">
      <div className="level-up" aria-live="polite">
        {show && (
          <div className="level-up-show" key={show.n} ref={showEl}>
            <span className="level-up-flash" aria-hidden="true" />
            <span className="level-up-ring" aria-hidden="true" />
            <span className="level-up-ring late" aria-hidden="true" />
            <span className="level-up-word">Level</span>
            <b className="level-up-number">{show.level}</b>
          </div>
        )}
        {reveal && <Unlocked key={`u${reveal.n}`} level={reveal.level} opens={reveal.opens} onDone={() => setReveal(null)} />}
        {!show && gift && (
          <div className="garment-show" key={`g${gift.n}`}>
            <span className="garment-show-rays" aria-hidden="true" />
            <GarmentPic g={gift.g} />
            <span className="garment-show-text">
              <span className="garment-show-word">New garment!</span>
              <b>{gift.g.name}</b>
              <small>In the wardrobe</small>
            </span>
          </div>
        )}
      </div>
    </TopSlot>
  )
}
