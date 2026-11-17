import { AnimatePresence, animate, m, useAnimate, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { art } from '../../ui/art'
import { flyGoods } from '../../ui/fly'
import { ArrowRight, Check, Clock, PaintBrush } from '../../ui/glyphs'
import { GoodPic } from '../../ui/GoodPic'
import { DID, FLIP, ITEM, MotionRoot, NOPE, PRESS, REVEAL, SQUISH } from '../../ui/motion'
import { PanelSheet } from '../../ui/PanelSheet'
import { Coins } from '../../ui/Shell'
import { produceById } from '../data'
import { iconUrl } from '../icons'
import { Bump, Ring } from '../machine/parts'
import type { ToolActions, ToolView } from '../toolView'
import './ToolPanel.css'

// An animal's tool, its panel (the design lab's animal-tools board, A, "the place itself", built further as the user
// asked: more of a farm, smarter to read): the design layer — it draws a ToolView and calls ToolActions, nothing of
// the farm in it (src/farm/ToolPanel.tsx feeds it the farm's).
//
// The panel draws the tool as it stands at the fence, and you tap it. The coop is a nest box under its little roof, a
// nest for every hen: her eggs in the straw with their number, her ring filling to her next egg and the time to it,
// a full nest glowing. The bucket is a wooden pail filling with the whole herd's milk, the cows as chips under it; the
// shears hang over a basket of the flock's wool, the sheep as chips. A tap on a nest or a chip takes from that one, a
// tap on the pail or the basket from the fullest: the target squishes, the goods fly into the barn's chip at the top
// (it counts up as each lands), the line says what came in. No room in the barn: the targets go grey, a berry ribbon
// across the place says so, the barn's chip is red and a tap shakes it. Nothing waiting: the line says when the next
// comes. Its two upgrades are chips under the place (now → next and its price, a peg a step): each opens its card,
// and once bought the chip turns over to its new words. Enter or Space on the sheet taps the tool. The good's picture
// at the top says where it is made (GoodPic). Motion: the game's (reduced motion: no flights, no squish).

export interface ToolPanelProps {
  v: ToolView
  act: ToolActions
  /** the player's coins (an upgrade's price shown short of them) */
  coins: number
  onClose: () => void
  /** what stands beside the sheet (the remote's tag of a panel opened from afar) */
  near?: ReactNode
  /** the panel asks it to go out */
  closing?: boolean
}

export function ToolPanelView(p: ToolPanelProps) {
  return (
    <MotionRoot>
      <Panel {...p} />
    </MotionRoot>
  )
}

interface Line {
  id: number
  tone: 'good' | 'bad' | 'calm'
  text: ReactNode
}

/** m:ss */
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.ceil(s % 60))).padStart(2, '0')}`
const cap = (t: string) => t[0].toUpperCase() + t.slice(1)
type Tap = (spot: number | undefined, from: Element | null) => void

function Panel({ v, act, coins, onClose, near, closing }: ToolPanelProps) {
  const still = useReducedMotion()
  const good = produceById(v.good)
  const chip = useRef<HTMLSpanElement>(null)
  // goods taken and still flying into the barn's chip: it counts up as each lands
  const [flying, setFlying] = useState(0)
  const [line, setLine] = useState<Line | null>(null)
  const lineId = useRef(0)
  const say = (tone: Line['tone'], text: ReactNode) => setLine({ id: ++lineId.current, tone, text })
  useEffect(() => {
    if (!line) return
    const t = window.setTimeout(() => setLine(null), 2400)
    return () => window.clearTimeout(t)
  }, [line])
  const all = v.spots.reduce((a, s) => a + s.has, 0)
  const full = v.room <= 0
  const soon = Math.min(...v.spots.map((s) => (s.has >= s.most ? Infinity : s.seconds)))
  const hero = useRef<HTMLDivElement>(null)

  const tap: Tap = (spot, from) => {
    const before = spot === undefined ? all : (v.spots[spot]?.has ?? 0)
    const n = act.tap(spot)
    if (!n) {
      if (from && !still) void animate(from, NOPE.keyframes, NOPE.options)
      if (before > 0) {
        if (chip.current && !still) void animate(chip.current, NOPE.keyframes, NOPE.options)
        say(
          'bad',
          <>
            <img className="art" src={iconUrl(v.store)} alt="" /> The {v.store} is full
          </>,
        )
      } else {
        const sp = spot === undefined ? null : v.spots[spot]
        say(
          'calm',
          <>
            <Clock weight="bold" /> {sp ? `${sp.name}: next in ${clock(sp.seconds)}` : `Next ${good.name} in ${clock(soon)}`}
          </>,
        )
      }
      return
    }
    setFlying((f) => f + n)
    void flyGoods(iconUrl(v.good), n, from, chip.current?.querySelector('img') ?? null, {
      size: 40,
      stagger: 55,
      duration: 460,
      landed: (_, k) => {
        setFlying((f) => Math.max(0, f - k))
        if (chip.current && !still) void animate(chip.current, DID.keyframes, DID.options)
      },
    })
    say(
      'good',
      <>
        <img className="art" src={iconUrl(v.good)} alt="" />+{n} {n === 1 ? good.name : good.plural} to the {v.store}
      </>,
    )
  }

  // Enter or Space on the sheet itself (not on one of its buttons): a tap of the tool, from the fullest
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.key !== 'Enter' && e.key !== ' ') || e.repeat || !(document.activeElement as Element | null)?.classList.contains('ps-sheet')) return
      e.preventDefault()
      tap(undefined, hero.current?.querySelector('[data-target]') ?? hero.current)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  return (
    <PanelSheet
      label={v.name}
      title={v.name}
      pic={art(v.art)}
      className={`tool-panel tp-${v.look}`}
      closing={closing}
      onClose={onClose}
      near={near}
      sub={
        <>
          <span className="tag tp-pertap" aria-label={`${v.perTap} a tap`}>
            <GoodPic good={v.good} className="tp-good" label={`${cap(good.plural)}: where they come from`} />
            <b>×{v.perTap}</b>
            <span className="tp-pertap-word">a tap</span>
          </span>
          <BarnChip v={v} shown={v.stored - flying} chip={chip} />
        </>
      }
    >
      <m.div className="tp-stage" variants={ITEM}>
        <div className={`tp-hero${full && all > 0 ? ' off' : ''}`} ref={hero}>
          {v.look === 'nests' ? <NestBox v={v} tap={tap} /> : <Vessel v={v} all={all} tap={tap} />}
          <AnimatePresence>
            {full && all > 0 && (
              <m.span key="full" className="tp-full ribbon" {...REVEAL} exit={{ opacity: 0, scale: 0.9 }}>
                {v.store === 'barn' ? 'Barn' : 'Silo'} full
              </m.span>
            )}
          </AnimatePresence>
        </div>
        {v.look !== 'nests' && <Herd v={v} tap={tap} />}
      </m.div>
      <m.div className="tp-side" variants={ITEM}>
        <div className="tp-ups">
          {v.ladders.map((l) => (
            <Upgrade key={l.id} l={l} coins={coins} onOpen={() => act.upgrade(l.id)} />
          ))}
        </div>
        <Said line={line} idle={idle(v, all, soon)} />
        <m.button className="btn soft small tp-skins" onClick={() => act.skins()} {...PRESS}>
          <PaintBrush weight="fill" />
          Skins
        </m.button>
      </m.div>
    </PanelSheet>
  )
}

/** How many a tap takes is in the head; the barn as a chip beside it: its picture, how full (red with no room). The
 *  goods fly into its picture, and it counts up as each lands. */
function BarnChip({ v, shown, chip }: { v: ToolView; shown: number; chip: RefObject<HTMLSpanElement | null> }) {
  const full = v.room <= 0
  return (
    <span ref={chip} className={`tag tp-barn${full ? ' short' : ''}`} aria-label={`${cap(v.store)}: ${v.stored} of ${v.capacity}${full ? ', full' : ''}`}>
      <img src={iconUrl(v.store)} alt="" />
      <Bump n={shown} />
      <span className="tp-barn-of">/{v.capacity}</span>
    </span>
  )
}

/** The idle line: no room in the barn, how many wait in all, or when the next comes. */
function idle(v: ToolView, all: number, soon: number): Omit<Line, 'id'> {
  const good = produceById(v.good)
  if (v.room <= 0 && all > 0)
    return {
      tone: 'bad',
      text: (
        <>
          <img className="art" src={iconUrl(v.store)} alt="" /> No room in the {v.store}
        </>
      ),
    }
  if (all > 0)
    return {
      tone: 'calm',
      text: (
        <>
          <img className="art" src={iconUrl(v.good)} alt="" />
          <span className="mp-count">{all}</span> waiting · tap to take
        </>
      ),
    }
  return {
    tone: 'calm',
    text: (
      <>
        <Clock weight="bold" /> Next {good.name} in <span className="mp-count">{clock(Number.isFinite(soon) ? soon : 0)}</span>
      </>
    ),
  }
}

/** The line under the upgrades: what a tap did, or why it did nothing (it goes after a moment); else what waits. */
function Said({ line, idle }: { line: Line | null; idle: Omit<Line, 'id'> }) {
  return (
    <div className="tp-said" aria-live="polite">
      <AnimatePresence mode="popLayout" initial={false}>
        {line ? (
          <m.p key={line.id} className={`mp-note ${line.tone}`} role="status" {...REVEAL} exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.12 } }}>
            {line.text}
          </m.p>
        ) : (
          <m.p key={`idle-${idle.tone}`} className={`mp-note ${idle.tone}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }}>
            {idle.text}
          </m.p>
        )}
      </AnimatePresence>
    </div>
  )
}

/** A spot's time to its next one, or that it is full. */
const When = ({ has, most, seconds }: { has: number; most: number; seconds: number }) =>
  has >= most ? (
    <span className="tp-when full">
      <Check weight="bold" />
      Full
    </span>
  ) : (
    <span className="tp-when">{clock(seconds)}</span>
  )

/** The coop's nest box: a nest for every hen, in rows of three, under its roof. */
function NestBox({ v, tap }: { v: ToolView; tap: Tap }) {
  const good = produceById(v.good)
  const off = v.room <= 0
  return (
    <div className="tp-coop">
      <i className="tp-roof" aria-hidden="true" />
      <div className="tp-box wood" role="group" aria-label={`${v.name}: ${v.spots.length} nests`}>
        {v.spots.map((sp, i) => (
          <m.button
            key={i}
            data-target
            className={`tp-nest${sp.has ? '' : ' empty'}${sp.has >= sp.most ? ' full' : ''}${off && sp.has ? ' off' : ''}`}
            onClick={(e) => tap(i, e.currentTarget.querySelector('.tp-eggs'))}
            aria-label={`${sp.name}: ${sp.has} ${sp.has === 1 ? good.name : good.plural}${sp.has ? `, tap to take ${Math.min(v.perTap, sp.has)}` : `, next in ${clock(sp.seconds)}`}`}
            {...SQUISH}
          >
            <span className="tp-straw" aria-hidden="true" />
            <span className="tp-eggs" aria-hidden="true">
              {Array.from({ length: Math.min(sp.has, 4) }, (_, k) => (
                <img key={k} className={`tp-egg e${k}`} src={iconUrl(v.good)} alt="" draggable={false} />
              ))}
            </span>
            <b className={`count tp-n${sp.has ? '' : ' none'}`}>{sp.has}</b>
            <span className="tp-hen" aria-hidden="true">
              <Ring size={34} stroke={4} value={sp.has >= sp.most ? 1 : sp.next} className="tp-ring" />
              <img src={art(v.animal)} alt="" />
            </span>
            <When has={sp.has} most={sp.most} seconds={sp.seconds} />
          </m.button>
        ))}
      </div>
    </div>
  )
}

/** The pail (the herd's milk, filling) or the wool basket under the shears: one target, the fullest animal first. */
function Vessel({ v, all, tap }: { v: ToolView; all: number; tap: Tap }) {
  const most = v.spots.reduce((a, sp) => a + sp.most, 0)
  const good = produceById(v.good)
  const [snip, cut] = useAnimate<HTMLSpanElement>()
  const still = useReducedMotion()
  return (
    <m.button
      data-target
      className={`tp-vessel${all ? '' : ' empty'}${all >= most ? ' full' : ''}`}
      onClick={(e) => {
        const had = all
        tap(undefined, e.currentTarget.querySelector('.tp-top'))
        if (had && snip.current && !still) void cut(snip.current, { rotate: [0, -18, 0] }, { duration: 0.26, ease: 'easeOut' })
      }}
      aria-label={`${v.name}: ${all} ${all === 1 ? good.name : good.plural} waiting${all ? `, tap to take ${v.perTap} from the fullest` : ''}`}
      {...SQUISH}
    >
      {v.look === 'pail' ? (
        <span className="tp-pail" aria-hidden="true">
          <i className="tp-handle" />
          <span className="tp-staves">
            <m.i className="tp-milk" initial={false} animate={{ height: `${Math.max(0, Math.min(1, all / Math.max(1, most))) * 100}%` }} />
            <i className="tp-hoop h1" />
            <i className="tp-hoop h2" />
          </span>
          <span className="tp-top" />
        </span>
      ) : (
        <span className="tp-basket" aria-hidden="true">
          <span className="tp-wool">
            {Array.from({ length: Math.min(all, 7) }, (_, k) => (
              <img key={k} className={`w${k}`} src={iconUrl(v.good)} alt="" draggable={false} />
            ))}
          </span>
          <img className="tp-basket-pic" src={art('basket')} alt="" draggable={false} />
          <span className="tp-top" />
          <span ref={snip} className="tp-shears">
            <img src={art(v.art)} alt="" draggable={false} />
          </span>
        </span>
      )}
      <span className="tp-total">
        <img src={iconUrl(v.good)} alt="" />
        <Bump n={all} />
      </span>
    </m.button>
  )
}

/** The cows or the sheep as chips: each one's own goods, a ring to her next and the time to it; a tap takes from her. */
function Herd({ v, tap }: { v: ToolView; tap: Tap }) {
  const good = produceById(v.good)
  const off = v.room <= 0
  return (
    <div className="tp-herd" role="group" aria-label={cap(v.kind)}>
      {v.spots.map((sp, i) => (
        <m.button
          key={i}
          className={`chip tp-animal${sp.has ? '' : ' empty'}${sp.has >= sp.most ? ' on' : ''}${off && sp.has ? ' off' : ''}`}
          onClick={(e) => tap(i, e.currentTarget.querySelector('.tp-animal-pic'))}
          aria-label={`${sp.name}: ${sp.has} ${sp.has === 1 ? good.name : good.plural}${sp.has ? '' : `, next in ${clock(sp.seconds)}`}`}
          {...SQUISH}
        >
          <span className="tp-animal-pic">
            <Ring size={40} stroke={4} value={sp.has >= sp.most ? 1 : sp.next} className="tp-ring" />
            <img src={art(v.animal)} alt="" />
          </span>
          <span className="tp-animal-text">
            <span className="tp-animal-name">{sp.name}</span>
            <When has={sp.has} most={sp.most} seconds={sp.seconds} />
          </span>
          <b className={`count${sp.has ? '' : ' none'}`}>{sp.has}</b>
        </m.button>
      ))}
    </div>
  )
}

/** An upgrade as a chip: its words, now → after its next step and the price, a peg for each step (Max at the top). It
 *  opens its card; bought, it turns over to its new words. */
function Upgrade({ l, coins, onOpen }: { l: ToolView['ladders'][number]; coins: number; onOpen: () => void }) {
  const [scope, play] = useAnimate<HTMLButtonElement>()
  const was = useRef(l.k)
  useEffect(() => {
    if (l.k > was.current && scope.current) {
      void play(scope.current, FLIP.keyframes, FLIP.options)
      void play(scope.current, DID.keyframes, DID.options)
    }
    was.current = l.k
  }, [l.k, play, scope])
  const max = !l.next
  return (
    <m.button
      ref={scope}
      className={`tp-up${max ? ' max' : ''}${!max && coins < l.price ? ' short' : ''}`}
      data-ladder={l.id}
      onClick={max ? undefined : onOpen}
      aria-disabled={max || undefined}
      aria-label={max ? `${l.name}: ${l.now}, the most` : `${l.name}: ${l.now} to ${l.next}, ${l.price} coins`}
      {...(max ? {} : PRESS)}
    >
      <span className="tp-up-name">{l.name}</span>
      <span className="tp-up-say">
        <span className="tp-up-now">{l.now}</span>
        {!max && (
          <>
            <ArrowRight weight="bold" className="effect-arrow" />
            <b>{l.next}</b>
          </>
        )}
      </span>
      {max ? (
        <span className="tag ok">
          <Check weight="bold" />
          Max
        </span>
      ) : (
        <span className="tp-up-price">
          <Coins n={l.price} />
        </span>
      )}
      <span className="tp-up-steps" aria-hidden="true">
        {Array.from({ length: l.steps }, (_, i) => (
          <i key={i} className={i < l.k ? 'on' : ''} />
        ))}
      </span>
    </m.button>
  )
}
