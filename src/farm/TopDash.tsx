import { animate, m, useAnimate, useMotionValue, useTransform } from 'motion/react'
import { useLessMotion } from '../ui/still'
import { Popover } from 'radix-ui'
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { coinsHeld, onCoinsHeld } from '../fx/coins'
import { useHome } from '../store'
import { art } from '../ui/art'
import { EASE, MotionRoot, SPRING } from '../ui/motion'
import { STORES, STORE_IDS, type StoreId } from './data'
import { DayChip } from './DayChip'
import { useGoalsReady } from './GoalsPanel'
import { iconUrl } from './icons'
import { capacity, farm, inLine, placesInLine, useFarm, used } from './state'
import { GIFT_FLY_MS, XpChip, useLevelCoinsInAir } from './XpChip'
import './TopDash.css'

// The top of the screen while you are outdoors (the design lab's board "top", variant D: a dashboard). Nothing is
// hidden, but everything is a small picture that shows its state: the coins (the hero) and the level as a short road
// from your star to the next level and its prize; under them the compass in the middle with two wings of gauges — on
// the left the silo and the barn, each a tank that fills (green, then sun, then red and shaking once when full), on the
// right the line at the gate and the goals with their counts. A gauge tapped tells its exact number in a bubble, with a
// way to open it. Upright: the coins, the road and the menu in one row, the compass and its wings under it; sideways,
// all of it in one row. The menu in the corner is ./../ui/HudMode.tsx.
//
// The compass is a slot of the top column (src/ui/TopStack.tsx): the dashboard keeps a hole for it between the wings
// and tells where it is (--hole-x, --hole-y, --hole-w on <html data-dash>), and the column's other slots (a toast, the
// level-up, the first hint) stand under the whole dashboard (--chips-bottom).

// the widths of a row lying sideways (./TopDash.css): the road, a wing of two gauges, the menu's place, a gap, and the
// least the compass may have between the wings
const ROAD = 196
const WING = 2 * 44 + 5
const MENU = 46
const GAP = 6
const MIN_HOLE = 150

/** The farm's numbers at the top, with the compass's place between its wings. */
export function TopDash() {
  useFarm((s) => s.rev)
  const dash = useRef<HTMLDivElement>(null)
  const hole = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = dash.current
    const gap = hole.current
    if (!el || !gap) return
    const root = document.documentElement
    const css = root.style
    const measure = () => {
      // sideways, one row when the compass keeps room enough between the wings; on a narrower screen two rows, as upright
      // but with the wings lying down (the fixed parts: the road, two wings of two, the menu's place, the gaps)
      const coins = el.querySelector<HTMLElement>('.coins')?.offsetWidth ?? 120
      const lay = !matchMedia('(orientation: landscape)').matches ? 'tall' : el.clientWidth >= coins + ROAD + 2 * WING + MENU + 5 * GAP + MIN_HOLE ? 'row' : 'two'
      if (el.dataset.lay !== lay) el.dataset.lay = lay
      const d = el.getBoundingClientRect()
      const h = gap.getBoundingClientRect()
      css.setProperty('--chips-bottom', `${Math.round(d.bottom)}px`)
      css.setProperty('--hole-x', `${Math.round(h.left)}px`)
      css.setProperty('--hole-y', `${Math.round(h.top)}px`)
      css.setProperty('--hole-w', `${Math.round(h.width)}px`)
    }
    root.dataset.dash = ''
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    ro.observe(gap)
    addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      removeEventListener('resize', measure)
      delete root.dataset.dash
      for (const p of ['--chips-bottom', '--hole-x', '--hole-y', '--hole-w']) css.removeProperty(p)
    }
  }, [])
  return (
    <MotionRoot>
      <div className="farm-chip top-dash" ref={dash} role="group" aria-label="Your coins, your level, the silo and the barn, the line at the gate and the goals">
        <Coins />
        <XpChip />
        <span className="top-dash-menu-spot" aria-hidden="true" />
        <div className="top-band">
          <m.div className="top-wing left" initial={{ opacity: 0, x: 26 }} animate={{ opacity: 1, x: 0 }} transition={{ ...SPRING.pop, delay: 0.14 }}>
            {STORE_IDS.map((id) => (
              <StoreGauge key={id} id={id} />
            ))}
          </m.div>
          <span className="top-hole" ref={hole}>
            <DayChip />
          </span>
          <m.div className="top-wing right" initial={{ opacity: 0, x: -26 }} animate={{ opacity: 1, x: 0 }} transition={{ ...SPRING.pop, delay: 0.14 }}>
            {farm.started ? <LineGauge /> : <span className="top-gauge-slot" />}
            <GoalsGauge />
          </m.div>
        </div>
      </div>
    </MotionRoot>
  )
}

/** How long after they take off the flying coins land (src/fx/coins.ts: the first after 0.7 s), less a little. */
const LAND_S = 0.62

/** The coins: the hero of the row. A rise counts in as the flying coins land, and the chip pops once with a light
 *  crossing it; a fall shows at once, the chip dipping for a moment (where the coins went from: the shared chips' dip,
 *  src/styles.css). A level's coins, come in by themselves, are held back until its crystals land on the bar, then
 *  counted in as the level-up show's coins reach the chip (./XpChip.tsx: LevelUp flies them GIFT_FLY_MS after). */
function Coins() {
  const level = useLevelCoinsInAir()
  // (and the daily gift's, still on its card: let go as they take off for the chip)
  const held = level + useSyncExternalStore(onCoinsHeld, coinsHeld)
  const coins = Math.max(0, farm.coins - held)
  const still = useLessMotion()
  const value = useMotionValue(coins)
  const text = useTransform(value, (n) => Math.round(n).toLocaleString('en-US'))
  const [chip, play] = useAnimate<HTMLSpanElement>()
  const last = useRef(coins)
  const lastHeld = useRef(level)
  useEffect(() => {
    const from = last.current
    last.current = coins
    // a level's coins let go as its crystals land: they reach the chip from its show, a moment later
    const fromShow = level < lastHeld.current
    lastHeld.current = level
    if (coins <= from || still) {
      value.set(coins)
      if (coins < from && !still && chip.current) void play(chip.current, { scale: [1, 0.9, 1] }, { duration: 0.4, ease: EASE.pop, times: [0, 0.3, 1] })
      return
    }
    const run = animate(value, coins, {
      delay: fromShow ? LAND_S + GIFT_FLY_MS / 1000 : LAND_S,
      duration: 0.42,
      ease: EASE.out,
      onComplete: () => {
        if (!chip.current) return
        void play(chip.current, { scale: [1, 1.12, 1] }, { duration: 0.35, ease: EASE.pop })
        void play('.top-coins-shine', { x: ['-120%', '260%'], opacity: [0, 1, 0] }, { duration: 0.6, ease: 'easeOut' })
        void play('img', { y: [0, 3, 0], scaleY: [1, 0.8, 1] }, { duration: 0.2, ease: EASE.out })
      },
    })
    return () => run.stop()
  }, [coins, level, still, value, chip, play])
  return (
    <m.span className="farm-chip-item coins" ref={chip} title="Coins" initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.pop, delay: 0.05 }}>
      <img src={art('coin')} alt="" />
      <m.b>{text}</m.b>
      <i className="top-coins-shine" aria-hidden="true" />
    </m.span>
  )
}

/**
 * A gauge: a tank its picture stands in, filled as far as it is full (from empty as it comes in, rising with a little
 * spring as goods come in); full, it turns red and shakes once. A count where it has one. A tap tells its number in a
 * bubble, with Open where it has a panel to open.
 */
function Gauge({
  className,
  pic,
  name,
  label,
  title,
  n,
  of,
  k,
  count,
  full,
  good,
  quiet,
  onOpen,
}: {
  className: string
  pic: ReactNode
  name: string
  label: string
  title: string
  n: number
  of?: number
  k?: number
  count?: number
  full?: boolean
  good?: boolean
  quiet?: boolean
  onOpen?: () => void
}) {
  const tone = full ? ' full' : good ? ' good' : (k ?? 0) >= 0.8 ? ' high' : ''
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <m.button
          className={`farm-chip-item top-gauge ${className}${tone}${quiet ? ' quiet' : ''}`}
          aria-label={label}
          title={title}
          whileTap={{ scale: 0.9 }}
          animate={full ? { x: [0, -4, 4, -3, 3, 0] } : undefined}
          transition={full ? { delay: 0.75, duration: 0.45 } : SPRING.pop}
        >
          {k !== undefined && <m.i className="top-tank" initial={{ scaleY: 0 }} animate={{ scaleY: Math.max(0.04, Math.min(1, k)) }} transition={{ ...SPRING.soft, delay: 0.3 }} />}
          {pic}
          {full ? (
            <m.b className="top-flag" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...SPRING.pop, delay: 0.9 }}>
              Full
            </m.b>
          ) : count !== undefined ? (
            <b className="top-count">{count}</b>
          ) : null}
        </m.button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="top-pop" side="bottom" sideOffset={8} collisionPadding={12}>
          <span className="top-pop-name">{name}</span>
          <b className="top-pop-num">
            {n}
            {of ? <small> / {of}</small> : null}
          </b>
          {onOpen && (
            <Popover.Close asChild>
              <button className="btn soft small top-pop-open" onClick={onOpen}>
                Open
              </button>
            </Popover.Close>
          )}
          <Popover.Arrow className="top-pop-arrow" width={14} height={7} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** How full the silo or the barn is: its tank, red and "Full" when full; its bubble opens its panel. */
function StoreGauge({ id }: { id: StoreId }) {
  const n = used(id)
  const cap = capacity(id)
  const full = n >= cap
  const name = STORES[id].name
  return (
    <Gauge
      className={`store ${id}`}
      pic={<img src={iconUrl(id)} alt="" />}
      name={name}
      label={`${name}: ${n} of ${cap}${full ? ', full' : ''} — open it`}
      title={`${name}: ${n} of ${cap}`}
      n={n}
      of={cap}
      k={n / cap}
      full={full}
      onOpen={() => !useHome.getState().panel && useHome.getState().openPanel({ kind: 'store', store: id })}
    />
  )
}

/** The buyers in line at the gate, of the places there are: green when every place is taken. Its bubble only tells:
 *  the line is served at the gate. */
function LineGauge() {
  const n = inLine().length
  const of = placesInLine()
  return (
    <Gauge
      className={`line${n >= of ? ' full' : ''}`}
      pic={<img className="art" src={art('people-queue')} alt="" />}
      name="Line at the gate"
      label={`Buyers in line at the gate: ${n} of ${of}`}
      title="Buyers in line at the gate"
      n={n}
      of={of}
      k={n / of}
      count={n}
      good={n >= of}
    />
  )
}

/** The goals board's trophy: how many goals wait to be claimed (green then), and its bubble opens the board. */
function GoalsGauge() {
  const ready = useGoalsReady()
  return (
    <Gauge
      className={`goals${ready ? ' ready' : ''}`}
      pic={<img className="art" src={art('trophy')} alt="" />}
      name="Goals reached"
      label={ready ? `Goals: ${ready} reached, to claim — open the board` : 'Goals — open the board'}
      title={ready ? `Goals: ${ready} to claim` : 'Goals'}
      n={ready}
      count={ready || undefined}
      good={ready > 0}
      quiet={!ready}
      onOpen={() => !useHome.getState().panel && useHome.getState().openPanel({ kind: 'goals' })}
    />
  )
}
