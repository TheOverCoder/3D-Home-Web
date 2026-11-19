import { animate, m } from 'motion/react'
import { useLessMotion } from './still'
import { Popover } from 'radix-ui'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { produceById, type ProduceId } from '../farm/data'
import { sourceOf } from '../farm/goods/sources'
import { Broadcast, CaretLeft, Crown, NavigationArrow, PersonSimpleWalk } from './glyphs'
import { ItemPic } from './ItemPic'
import { PRESS, REVEAL, SHIMMER, SPRING, TIP } from './motion'
import { sidewaysNow } from './sheetMode'

// A good's picture in a panel (the base; plans/animal-tools.md, "where is it made"): the ItemPic with its count, and a
// tap opens its bubble — its name, how many the farm keeps of it, where it comes from (src/farm/goods/sources.ts) and
// one button, as the game picks it (src/farm/goods/go.ts, goFor): "Show me" walks you there, a remote's "Open the mill"
// (the premium look, night velvet) opens that panel from afar, or nothing. A panel puts GoodPic where it had an
// ItemPic, and every good's picture in it says where it is made; what the button does is the game's (GoodWays, given
// once round the farm's panels: src/farm/goods/GoodWays.tsx), so the design lab shows the bubble with no farm behind
// it. Never on a picture inside another button (a recipe card, a seed packet), the action button or the top's chips.

/** What the button under a good's words does here: walk there, open a panel from afar (a remote's), or nothing. */
export type GoodGo = { kind: 'walk'; run: () => void } | { kind: 'open'; words: string; pic: string; run: () => void } | { kind: 'none' }

export interface GoodWays {
  go: (good: ProduceId) => GoodGo
  /** how many the farm keeps of a good, and where ("12 in the barn"); null: nothing said */
  kept: (good: ProduceId) => { n: number; store: string } | null
}

const NONE: GoodWays = { go: () => ({ kind: 'none' }), kept: () => null }
export const GoodWaysContext = createContext<GoodWays>(NONE)

const cap = (t: string) => t[0].toUpperCase() + t.slice(1)

export function GoodPic({
  good,
  count,
  className = '',
  label,
  lines,
  walk = true,
  way = false,
  open,
  onOpenChange,
  children,
}: {
  good: ProduceId
  count?: number
  className?: string
  /** what a screen reader says of the picture (else its name and "where is it made") */
  label?: string
  /** the bubble's own lines under the name, in place of how many the farm keeps (the orders board: how many are in) */
  lines?: ReactNode
  /** whether "Show me" may walk you there from this panel (the orders board: only while the store is short) */
  walk?: boolean
  /** the walker on its corner: a tap shows the way there (the orders board: a good the store is short of) */
  way?: boolean
  /** the bubble open or not, when the panel keeps it (one at a time, Esc) */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** more on the picture (a ✓) */
  children?: ReactNode
}) {
  const ways = useContext(GoodWaysContext)
  const [own, setOwn] = useState(false)
  const shown = open ?? own
  const setShown = (o: boolean) => (onOpenChange ? onOpenChange(o) : setOwn(o))
  const name = produceById(good)
  return (
    <Popover.Root open={shown} onOpenChange={setShown}>
      <Popover.Trigger asChild>
        <m.button className={`good-pic ${className}`} data-good={good} aria-label={label ?? `${cap(name.plural)}: where is it made`} {...TIP}>
          <ItemPic id={good} count={count} />
          {way && (
            <i className="good-way" aria-hidden="true">
              <PersonSimpleWalk weight="bold" />
            </i>
          )}
          {children}
        </m.button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="ob-pop good-pop"
          // (over the sheet: Esc closes this first, src/ui/PanelSheet.tsx)
          data-over-sheet=""
          side="top"
          sideOffset={6}
          // sideways, clear of a phone's notch and rounded corners
          collisionPadding={sidewaysNow() ? { top: 10, bottom: 26, left: 54, right: 54 } : 12}
          onEscapeKeyDown={(e) => e.stopPropagation()}
        >
          {shown && <Bubble good={good} lines={lines} walk={walk} ways={ways} close={() => setShown(false)} />}
          <Popover.Arrow className="ob-pop-arrow" width={14} height={7} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function Bubble({ good, lines, walk, ways, close }: { good: ProduceId; lines?: ReactNode; walk: boolean; ways: GoodWays; close: () => void }) {
  const src = sourceOf(good)
  const go = ways.go(good)
  const kept = lines === undefined ? ways.kept(good) : null
  return (
    <m.div {...REVEAL}>
      <b className="ob-pop-name">{produceById(good).name}</b>
      {lines}
      {kept && <span className="ob-pop-store">{kept.n > 0 ? `${kept.n} in the ${kept.store}` : `None in the ${kept.store}`}</span>}
      <span className="ob-src">
        <img className="art" src={src.pic} alt="" />
        <span>
          {src.words}
          {src.from && (
            <>
              {' from '}
              <span className="ob-from">
                {src.from.map((f) => (
                  <ItemPic key={f} id={f} />
                ))}
              </span>
            </>
          )}
        </span>
      </span>
      {go.kind === 'walk' && walk && (
        <button
          className="btn soft small ob-show"
          onClick={() => {
            close()
            go.run()
          }}
        >
          <NavigationArrow weight="fill" /> Show me
        </button>
      )}
      {go.kind === 'open' && <OpenButton words={go.words} pic={go.pic} run={go.run} />}
    </m.div>
  )
}

/** A remote's button (the premium look: night velvet, a crown, its gold words): pressed, the remote's waves go out of
 *  it, then the panel opens from afar (at once with less motion). */
export function OpenButton({ words, pic, run }: { words: string; pic: string; run: () => void }) {
  const still = useLessMotion()
  const press = (el: HTMLElement) => {
    if (still) return run()
    el.querySelectorAll<HTMLElement>('.good-wave').forEach((w, i) => void animate(w, { scale: [0.6, 2.4], opacity: [0.9, 0] }, { duration: 0.55, delay: i * 0.12, ease: 'easeOut' }))
    window.setTimeout(run, 420)
  }
  return (
    <m.button className="btn small velvet good-open" {...PRESS} onClick={(e) => press(e.currentTarget)} aria-label={`${words} (remote)`}>
      <span className="good-waves" aria-hidden="true">
        <i className="good-wave" />
        <i className="good-wave" />
        <i className="good-wave" />
      </span>
      <Crown weight="fill" className="crown" />
      <img className="good-open-pic" src={pic} alt="" />
      {words}
      <m.i className="shine" aria-hidden="true" {...SHIMMER()} />
    </m.button>
  )
}

/** The tag of a panel opened from afar by a remote (the premium look): a dark pill over the sheet's top with the way
 *  back to where it was opened ("‹ Barn"), and "Remote" with its waves. It stands on the sheet's edge (upright over its
 *  middle, sideways beside its head), following it as it comes in or is swiped. */
export function RemoteTag({ back, onBack }: { back: string; onBack: () => void }) {
  const at = useSheetAt()
  if (!at) return null
  return (
    <m.div
      className={`remote-tag${at.wide ? ' wide' : ''}`}
      style={at.wide ? { right: innerWidth - at.x + 10, top: at.y + 66 } : { left: at.x, top: at.y - 52 }}
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ ...SPRING.pop, delay: 0.32 }}
    >
      <m.button className="remote-back" onClick={onBack} {...PRESS} aria-label={`Back to the ${back.toLowerCase()}`}>
        <CaretLeft weight="bold" />
        {back}
      </m.button>
      <span className="remote-word velvet">
        <Broadcast weight="bold" className="remote-cast" />
        Remote
      </span>
    </m.div>
  )
}

/** Where the sheet of the panel open is, every frame while the tag stands (it slides in, a finger drags it). */
function useSheetAt() {
  const [at, setAt] = useState<{ x: number; y: number; wide: boolean } | null>(null)
  useEffect(() => {
    let raf = 0
    let last = ''
    const read = () => {
      const el = document.querySelector('.mp-sheet')
      if (el) {
        const r = el.getBoundingClientRect()
        const wide = sidewaysNow()
        const now = { x: wide ? r.left : r.left + r.width / 2, y: r.top, wide }
        const key = `${Math.round(now.x)},${Math.round(now.y)},${wide}`
        if (key !== last) {
          last = key
          setAt(now)
        }
      }
      raf = requestAnimationFrame(read)
    }
    read()
    return () => cancelAnimationFrame(raf)
  }, [])
  return at
}
