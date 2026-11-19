import { AnimatePresence, m, useAnimate, useDragControls, type PanInfo } from 'motion/react'
import { useLessMotion } from '../../ui/still'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { produceById, storeOf, type ProduceId } from '../data'
import { iconUrl } from '../icons'
import type { MachineActions, MachineView, QueueSlot, RecipeView } from '../machineView'
import { art, type ArtId } from '../../ui/art'
import { celebrate } from '../../fx/reward'
import { rewardKind } from '../../lib/tier'
import { GoodPic } from '../../ui/GoodPic'
import { CaretLeft, Check, Clock, HandGrabbing, LockSimple, X } from '../../ui/glyphs'
import { ARRIVE, MotionRoot, PRESS, SHEET, SPRING, swipedAway } from '../../ui/motion'
import { useSheetMode } from '../../ui/sheetMode'
import { useDragDrop, type Axis } from './drag'
import { flyInto, storeChip } from '../../ui/fly'
import { LevelChip, LevelPage } from './MachineLevel'
import { Bump, useCountdown } from './parts'
import { QueueGrid, type QueueHandlers } from './QueueGrid'
import { cells as cellsOf, clock, dropOf, nextKeys, nextTarget, queueLeft, timesCan, type CellKind, type Drop, type Hit, type KeyOp, type Payload, type Target } from './queue'
import { RecipeCard } from './RecipeCard'
import './MachinePanel.css'

// A machine's panel (the oven, the mill, the loom): the design layer — it draws a `MachineView` and calls its
// `MachineActions`, nothing of the farm in it (./Preview.tsx feeds it sample data; the game, the farm's).
//
// One sheet: the queue at the top (the hero: its places, the job at work with its time, what is done glowing, one
// button to collect it all), the recipes under it (sideways: beside it) to drag into the places or tap, and the
// machine's level as a chip that opens its own page in the same sheet (what this level gives, and the next). It comes in
// on the sheet's spring (from the bottom upright, the right sideways), its places and cards one after another; a
// swipe of its top down (sideways: right) or ✕ sends it out the same way.

export interface MachinePanelProps {
  v: MachineView
  act: MachineActions
  /** the player's coins (the next place's price is shown short of them); the view does not carry them */
  coins?: number
  onClose: () => void
  /** opens with the card that asks for the next place already open */
  buying?: boolean
}

/** The panel, with the game's motion round it (it may be the first thing in the game to use Motion). */
export function MachinePanelView(p: MachinePanelProps) {
  return (
    <MotionRoot>
      <Panel {...p} />
    </MotionRoot>
  )
}

/** The picture at the top of each machine's panel. */
const PICTURE: Record<string, ArtId> = { oven: 'shortcake', mill: 'sheaf-of-rice', loom: 'yarn', dairy: 'cheese-wedge', kettle: 'pot-of-food' }
const cap = (t: string) => t[0].toUpperCase() + t.slice(1)

/** Each job's key, following the changes the panel asks for (./queue.ts, nextKeys). */
function useJobKeys(slots: QueueSlot[]) {
  const mem = useRef({ sig: '\u0000', keys: [] as string[], slots: [] as QueueSlot[], op: null as KeyOp | null, next: null as string | null, n: 0 })
  const st = mem.current
  const sig = slots.map((s) => `${s.recipe}:${s.state}`).join(',')
  if (sig !== st.sig) {
    st.keys = nextKeys(st.keys, st.slots, slots, st.op, () => {
      const k = st.next ?? `job-${st.n++}`
      st.next = null
      return k
    })
    st.op = null
    st.sig = sig
    st.slots = slots
  }
  return {
    keys: st.keys,
    /** a new job's key, before it is added */
    fresh: () => (st.next = `job-${st.n++}`),
    expect: (op: KeyOp) => (st.op = op),
  }
}

/**
 * What lies under the dragged picture, as the queue's rules read it: inside the places' grid, the place nearest to it
 * where it is laid out (not where it is sliding to: a place making room must not move out from under the finger and
 * back), so the gaps between places count as the nearest; else the queue round them, or nothing.
 */
function hitAt(at: { x: number; y: number }, el: Element | null): Hit {
  const grid = document.querySelector<HTMLElement>('.mp-places')
  if (grid) {
    const g = grid.getBoundingClientRect()
    if (at.x >= g.left && at.x <= g.right && at.y >= g.top && at.y <= g.bottom) {
      let best: HTMLElement | null = null
      let far = Infinity
      for (const c of grid.querySelectorAll<HTMLElement>(':scope > [data-cell]')) {
        // one on its way out (taken from the grid while it fades) is no place
        if (c.hasAttribute('data-motion-pop-id')) continue
        const d = Math.hypot(at.x - (g.left + c.offsetLeft + c.offsetWidth / 2), at.y - (g.top + c.offsetTop + c.offsetHeight / 2))
        if (d < far) {
          far = d
          best = c
        }
      }
      if (best) return { cell: best.dataset.kind as CellKind, index: Number(best.dataset.cell) }
    }
  }
  return el?.closest('[data-drop="queue"]') ? { queue: true } : null
}
const sameTarget = (a: Target, b: Target) => (a === null || b === null ? a === b : 'out' in a ? 'out' in b : 'at' in b && a.at === b.at)
const twoFrames = (f: () => void) => requestAnimationFrame(() => requestAnimationFrame(f))
const picOf = (key: string) => document.querySelector<HTMLElement>(`.mp-places [data-key="${key}"] [data-pic]`) ?? document.querySelector<HTMLElement>(`.mp-places [data-key="${key}"]`)

interface Note {
  id: number
  text: ReactNode
  tone: 'bad' | 'good' | 'xp'
  /** it holds goods' pictures to tap (what a recipe lacks): it stays longer, and while a good's bubble is open */
  long?: boolean
}

function Panel({ v, act, coins, onClose, buying }: MachinePanelProps) {
  const mode = useSheetMode()
  const still = useLessMotion()
  const [page, setPageNow] = useState<'queue' | 'level'>('queue')
  // the sheet keeps its height from one page to the other (the level's page is shorter: the sheet must not jump)
  const [tall, setTall] = useState<number | null>(null)
  const setPage = (to: 'queue' | 'level') => {
    if (to === 'level' && sheet.current) setTall(sheet.current.offsetHeight)
    setPageNow(to)
  }
  const [leaving, setLeaving] = useState(false)
  const [opening, setOpening] = useState(true)
  const sheet = useRef<HTMLDivElement>(null)
  const controls = useDragControls()
  useEffect(() => {
    sheet.current?.focus({ preventScroll: true })
    const t = window.setTimeout(() => setOpening(false), 900)
    return () => window.clearTimeout(t)
  }, [])
  const close = () => setLeaving(true)
  /** anything pressed in the panel yet (the first-time hint stops showing how) */
  const [touched, setTouched] = useState(false)

  // ── the queue's jobs, and what is dragged over them ──
  const jk = useJobKeys(v.slots)
  const slotsNow = useRef(v.slots)
  slotsNow.current = v.slots
  const [target, setTarget] = useState<Target>(null)
  const targetNow = useRef<Target>(null)
  const setTo = (t: Target) => {
    if (sameTarget(t, targetNow.current)) return
    targetNow.current = t
    setTarget(t)
  }
  const [picked, setPicked] = useState<number | null>(null)
  const [arriving, setArriving] = useState<string | null>(null)
  const [note, setNote] = useState<Note | null>(null)
  const noteId = useRef(0)
  const say = (text: ReactNode, tone: Note['tone'], long = false) => setNote({ id: ++noteId.current, text, tone, long })
  useEffect(() => {
    if (!note) return
    let t = 0
    const end = () => {
      if (note.long && document.querySelector('.good-pop')) t = window.setTimeout(end, 1000)
      else setNote(null)
    }
    t = window.setTimeout(end, note.long ? 6000 : 2400)
    return () => window.clearTimeout(t)
  }, [note])
  const [shakes, setShakes] = useState<Record<string, number>>({})
  const [nudge, setNudge] = useState(0)

  /** Does a drop (or a tap, a key) and says where its picture lands: the job's place, or the recipe it went back to. */
  const run = (d: Drop): (() => DOMRect | null) | null => {
    if (!d) return null
    if ('add' in d) {
      const key = jk.fresh()
      const at = d.at ?? v.slots.length
      if (!act.add(d.add, d.at)) return null
      jk.expect({ add: at })
      setArriving(key)
      return () => picOf(key)?.getBoundingClientRect() ?? null
    }
    if ('move' in d) {
      const key = jk.keys[d.move[0]]
      if (!act.move(d.move[0], d.move[1])) return null
      jk.expect({ move: d.move })
      setArriving(key)
      return () => picOf(key)?.getBoundingClientRect() ?? null
    }
    const recipe = v.slots[d.remove]?.recipe
    if (!act.remove(d.remove)) return null
    jk.expect({ remove: d.remove })
    setPicked(null)
    // its ingredients go back: the picture flies home to its recipe
    return () => document.querySelector(`[data-recipe="${recipe}"] .mp-recipe-pic`)?.getBoundingClientRect() ?? null
  }
  useEffect(() => {
    if (!arriving) return
    const t = window.setTimeout(() => setArriving(null), 420)
    return () => window.clearTimeout(t)
  }, [arriving])

  const drag = useDragDrop<Payload>({
    onLift: () => {
      setPicked(null)
      targetNow.current = null
      setTarget(null)
    },
    onOver: (at, el, p) => setTo(nextTarget(targetNow.current, hitAt(at, el), p, slotsNow.current)),
    onDrop: (p) => {
      const d = dropOf(p, targetNow.current, slotsNow.current)
      targetNow.current = null
      setTarget(null)
      return run(d)
    },
  })
  const lifted = drag.lifted
  const carrying = lifted?.payload
  const cells = cellsOf(v.slots, jk.keys, v.capacity, carrying ? { payload: carrying, target } : null)
  const holeSrc = carrying ? (carrying.kind === 'recipe' ? iconUrl(v.recipes.find((r) => r.id === carrying.recipe)!.makes) : iconUrl(v.slots[carrying.index]?.makes ?? 'egg')) : null
  const outOfQueue = carrying?.kind === 'job' && target !== null && 'out' in target

  // ── collecting: the done goods fly into the button, then up to the barn's chip ──
  const done = v.slots.filter((s) => s.state === 'done')
  const [flying, setFlying] = useState<{ n: number; src: string[] } | null>(null)
  const collectBtn = useRef<HTMLButtonElement>(null)
  const [squash, squashIt] = useAnimate()
  const collect = () => {
    if (flying || !done.length) return
    const doneCells = cells.filter((c) => c.kind === 'done' && c.slot)
    const flights = doneCells.flatMap((c) => {
      const el = picOf(c.key)
      return el ? [{ src: iconUrl(c.slot!.makes), from: el.getBoundingClientRect() }] : []
    })
    const n = act.collect()
    if (!n) {
      say(
        <>
          <img className="art" src={iconUrl(storeOf(done[0].makes))} alt="" /> The {storeOf(done[0].makes)} is full
        </>,
        'bad',
      )
      if (squash.current) void squashIt(squash.current, { x: [0, -8, 7, -4, 0] }, { duration: 0.34 })
      return
    }
    jk.expect({ collect: n })
    setPicked(null)
    const made = done.slice(0, n)
    const btn = collectBtn.current?.getBoundingClientRect()
    setFlying({ n, src: [...new Set(made.map((s) => iconUrl(s.makes)))] })
    const thanks = () => {
      setFlying(null)
      if (n < done.length)
        say(
          <>
            <img className="art" src={iconUrl(storeOf(done[0].makes))} alt="" /> The {storeOf(done[0].makes)} is full
          </>,
          'bad',
        )
      else
        say(
          <>
            <Check weight="bold" /> {n === 1 ? `A ${produceById(made[0].makes).name}` : `${n} ${new Set(made.map((s) => s.makes)).size === 1 ? produceById(made[0].makes).plural : 'goods'}`} to the{' '}
            {storeOf(made[0].makes)}
          </>,
          'good',
        )
    }
    if (!btn) return thanks()
    void flyInto(flights.slice(0, n), btn, {
      size: 44,
      landed: () => {
        if (squash.current) void squashIt(squash.current, { scaleX: [1, 1.08, 0.97, 1], scaleY: [1, 0.86, 1.04, 1] }, { duration: 0.26 })
      },
    }).then(() => {
      const chip = storeChip(storeOf(made[0].makes))
      if (chip && !still)
        void flyInto(
          flights.slice(0, Math.min(n, 4)).map((f) => ({ src: f.src, from: btn })),
          chip,
          { size: 34, stagger: 60, duration: 560 },
        )
      thanks()
    })
  }

  // ── a recipe tapped: into the next free place (its picture flies there); can't: why ──
  const tap = (r: RecipeView, pic: HTMLElement | null) => {
    if (!r.can) {
      if (r.locked !== undefined) {
        setShakes((s) => ({ ...s, [r.id]: (s[r.id] ?? 0) + 1 }))
        say(`Opens at level ${r.locked}`, 'bad')
      } else if (timesCan(r) === 0) {
        setShakes((s) => ({ ...s, [r.id]: (s[r.id] ?? 0) + 1 }))
        // what it lacks, each a picture that says where it is made (a remote's: opens its machine)
        const lack = (Object.entries(r.needs) as [ProduceId, number][]).filter(([k, n]) => (r.have[k] ?? 0) < n).map(([k]) => k)
        say(
          <>
            Not enough
            <span className="mp-lack">
              {lack.map((k) => (
                <GoodPic key={k} good={k} />
              ))}
            </span>
            for a {produceById(r.makes).name}
          </>,
          'bad',
          true,
        )
      } else {
        setNudge((n) => n + 1)
        say(
          <>
            <LockSimple weight="fill" /> The queue is full
          </>,
          'bad',
        )
      }
      return
    }
    const from = pic?.getBoundingClientRect()
    const find = run({ add: r.id })
    if (!find || !from) return
    twoFrames(() => {
      const to = find()
      if (to) void flyInto([{ src: iconUrl(r.makes), from }], to, { size: 44, duration: 420 })
    })
  }

  const h: QueueHandlers = {
    press: drag.press,
    wasDrag: drag.wasDrag,
    remove: (i) => {
      const find = run({ remove: i })
      const from = picOf(jk.keys[i])?.getBoundingClientRect()
      const src = v.slots[i] && iconUrl(v.slots[i].makes)
      if (find && from && src)
        twoFrames(() => {
          const to = find()
          if (to) void flyInto([{ src, from }], to, { size: 40, duration: 420 })
        })
    },
    moveBy: (i, by) => {
      const first = v.slots.findIndex((s) => s.state === 'waiting')
      const to = Math.max(first, Math.min(v.slots.length - 1, i + by))
      if (first >= 0 && to !== i) run({ move: [i, to] })
    },
    collect,
  }

  // ── the level: one celebration as it is reached ──
  const was = useRef(v.level.n)
  const [chip, popChip] = useAnimate()
  useEffect(() => {
    if (v.level.n > was.current) {
      // a level, as big as a level is at least (it pays nothing of its own: dearer goods from now on); its sound is the
      // collect's that reached it
      celebrate('level', rewardKind('level').least ?? 'big', document.querySelector('.mp-lv-ring, .mp-level'), { sound: false })
      if (chip.current) void popChip(chip.current, { scale: [1, 1.35, 0.92, 1] }, { duration: 0.6 })
      const b = v.level.boost
      say(
        <>
          <img className="art mp-xp-pic" src={art('gem-stone')} alt="" /> Level {v.level.n}: +{Math.round(b.xp * 100)} % XP and coins
        </>,
        'xp',
      )
    }
    was.current = v.level.n
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.level.n])

  // ── the recipes' list: does it scroll (then a finger drags across it, or holds a card a moment) ──
  const list = useRef<HTMLDivElement>(null)
  const [axis, setAxis] = useState<Axis>('none')
  useEffect(() => {
    const el = list.current
    if (!el) return
    const measure = () => setAxis(el.scrollHeight > el.clientHeight + 2 ? 'y' : 'none')
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    measure()
    return () => ro.disconnect()
  }, [page])

  // ── Esc: back from the level's page, else the way out (before the game's own Esc, which would close it at once);
  // on a computer, a recipe's number puts it in (as a tap on its card) ──
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // (a good's bubble open: Esc closes it first)
        if (drag.lifted || document.querySelector('.good-pop')) return
        e.stopPropagation()
        if (page === 'level') setPageNow('queue')
        else setLeaving(true)
        return
      }
      const n = Number(e.key)
      const r = page === 'queue' && !e.repeat && n >= 1 && n <= 9 ? v.recipes[n - 1] : undefined
      if (!r || (e.target as Element | null)?.closest?.('input, select, textarea')) return
      tap(r, document.querySelector<HTMLElement>(`[data-recipe="${r.id}"] .mp-recipe-pic`))
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  })

  const letGo = (_: unknown, i: PanInfo) => swipedAway(mode, i) && setLeaving(true)

  const total = useCountdown(queueLeft(v.slots))
  const working = v.slots.find((s) => s.state === 'working')
  const queuedMinutes = queueLeft(v.slots) / 60
  const full = v.slots.length >= v.capacity
  const coach = !touched && !still && page === 'queue' && v.slots.length === 0 && !lifted ? v.recipes.find((r) => r.can) : undefined

  return (
    <div className={`mp-root mp-${mode}`}>
      <m.div className="mp-shade" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: leaving ? 0 : 1 }} transition={{ duration: leaving ? 0.18 : 0.24 }} onClick={close} />
      <m.div
        ref={sheet}
        className="mp-sheet farm-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`${v.name}, level ${v.level.n}`}
        tabIndex={-1}
        custom={mode}
        style={tall && mode !== 'right' ? { minHeight: tall } : undefined}
        variants={SHEET}
        initial="hidden"
        animate={leaving ? 'out' : 'show'}
        onAnimationComplete={(d) => d === 'out' && onClose()}
        drag={mode === 'middle' ? false : mode === 'right' ? 'x' : 'y'}
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
        dragElastic={mode === 'right' ? { right: 0.9, left: 0 } : { bottom: 0.9, top: 0 }}
        dragMomentum={false}
        onDragEnd={letGo}
        onPointerDownCapture={(e) => {
          setTouched(true)
          if (picked !== null && !(e.target as Element).closest('.mp-place.picked')) setPicked(null)
        }}
      >
        <header
          className="mp-head"
          onPointerDown={(e) => {
            if (mode !== 'middle' && !(e.target as Element).closest('button')) controls.start(e)
          }}
        >
          <i className="mp-grab" aria-hidden="true" />
          <AnimatePresence mode="popLayout" initial={false}>
            {page === 'queue' ? (
              <m.img key="pic" className="art mp-head-art" src={art(PICTURE[v.id] ?? 'gear')} alt="" {...ARRIVE} exit={{ scale: 0.4, opacity: 0 }} />
            ) : (
              <m.button
                key="back"
                className="mp-round"
                onClick={() => setPage('queue')}
                aria-label={`Back to the ${v.name.toLowerCase()}`}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                {...PRESS}
              >
                <CaretLeft weight="bold" />
              </m.button>
            )}
          </AnimatePresence>
          <div className="mp-head-text">
            <h2>{v.name}</h2>
            <div className="mp-sub">
              {page === 'queue' ? (
                <>
                  <span ref={chip} className="mp-level-wrap">
                    <LevelChip level={v.level} name={v.name} onOpen={() => setPage('level')} />
                  </span>
                  {total > 0 && (
                    <span className="tag mp-total" aria-label={`All done in ${clock(total)}`}>
                      <Clock weight="bold" />
                      {clock(total)}
                    </span>
                  )}
                </>
              ) : (
                v.level.next !== null && <span className="tag">{`${Math.round(v.level.progress * 100)} % to level ${v.level.n + 1}`}</span>
              )}
            </div>
          </div>
          <m.button className="mp-round" onClick={close} aria-label="Close (Esc)" {...PRESS}>
            <X weight="bold" />
          </m.button>
        </header>
        <AnimatePresence mode="popLayout" initial={false}>
          {page === 'queue' ? (
            <m.div key="queue" className="mp-body" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={SPRING.sheet}>
              <section className={`mp-queue${outOfQueue ? ' out' : ''}`} data-drop="queue" aria-label={`Queue: ${v.slots.length} of ${v.capacity} places`}>
                <QueueGrid
                  cells={cells}
                  lifted={lifted}
                  holeSrc={holeSrc}
                  outOfQueue={outOfQueue}
                  picked={picked}
                  setPicked={setPicked}
                  h={h}
                  upgrade={v.upgrade}
                  coins={coins}
                  onBuy={() => act.buySlot()}
                  nudge={nudge}
                  opening={opening}
                  arriving={arriving}
                  buying={buying}
                />
                <div className="mp-foot">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {done.length > 0 || flying ? (
                      <m.button
                        key="collect"
                        ref={collectBtn}
                        className="btn mp-collect"
                        onClick={collect}
                        aria-label={`Collect ${flying?.n ?? done.length}`}
                        initial={{ opacity: 0, scale: 0.7, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.14 } }}
                        {...PRESS}
                      >
                        <span ref={squash} className="mp-collect-in">
                          <span className="mp-collect-pics" aria-hidden="true">
                            {(flying?.src ?? [...new Set(done.map((s) => iconUrl(s.makes)))]).slice(0, 3).map((src) => (
                              <img key={src} className="art" src={src} alt="" />
                            ))}
                          </span>
                          Collect
                          <span className="mp-collect-n">
                            <Bump n={flying?.n ?? done.length} />
                          </span>
                        </span>
                      </m.button>
                    ) : note ? (
                      <m.p
                        key={`note-${note.id}`}
                        className={`mp-note ${note.tone}`}
                        role="status"
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.12 } }}
                        transition={SPRING.pop}
                      >
                        {note.text}
                      </m.p>
                    ) : working ? (
                      <m.p
                        key="next"
                        className="mp-note calm"
                        aria-label={`${cap(produceById(working.makes).name)} ready in ${clock(working.left)}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      >
                        <img className="art" src={iconUrl(working.makes)} alt="" />
                        <span>
                          Ready in <Countdown left={working.left} />
                        </span>
                      </m.p>
                    ) : (
                      <m.p key="hint" className="mp-note hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }}>
                        <HandGrabbing weight="fill" />
                        {mode === 'right' ? 'Drag a recipe here, or tap it' : 'Drag a recipe up here, or tap it'}
                      </m.p>
                    )}
                  </AnimatePresence>
                  {/* a note while the Collect button shows: over it, for a moment */}
                  <AnimatePresence>
                    {note && (done.length > 0 || flying) && (
                      <m.p
                        key={`over-${note.id}`}
                        className={`mp-note float ${note.tone}`}
                        role="status"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, transition: { duration: 0.12 } }}
                        transition={SPRING.pop}
                      >
                        {note.text}
                      </m.p>
                    )}
                  </AnimatePresence>
                </div>
              </section>
              <div className="mp-recipes" ref={list} aria-label="Recipes">
                <div className="mp-recipes-in">
                  {v.recipes.map((r, i) => (
                    <RecipeCard
                      key={r.id}
                      r={r}
                      full={full}
                      axis={axis}
                      carried={carrying?.kind === 'recipe' && carrying.recipe === r.id}
                      shake={shakes[r.id] ?? 0}
                      press={drag.press}
                      wasDrag={drag.wasDrag}
                      onTap={tap}
                      index={i}
                      opening={opening}
                    />
                  ))}
                </div>
              </div>
            </m.div>
          ) : (
            <m.div key="level" className="mp-body level" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={SPRING.sheet}>
              <LevelPage level={v.level} queued={queuedMinutes} name={v.name} />
            </m.div>
          )}
        </AnimatePresence>
      </m.div>
      {lifted &&
        createPortal(
          <m.div
            className={`mp-ghost${outOfQueue ? ' out' : ''}${carrying?.kind === 'recipe' && !target ? ' lost' : ''}`}
            style={{ x: drag.ghost.x, y: drag.ghost.y, scale: drag.ghost.scale, rotate: drag.ghost.rotate, opacity: drag.ghost.opacity, width: 64, height: 64, marginLeft: -32, marginTop: -32 }}
            aria-hidden="true"
          >
            <img src={lifted.src} alt="" draggable={false} />
            {outOfQueue && (
              <span className="mp-ghost-x">
                <X weight="bold" />
              </span>
            )}
          </m.div>,
          document.body,
        )}
      {coach && !leaving && <Coach key={coach.id} recipe={coach.id} src={iconUrl(coach.makes)} />}
    </div>
  )
}

/**
 * The first time (an empty queue, nothing pressed yet): a hand carries the first recipe that can be made from its card
 * into the first empty place, again and again, until a finger does it — teaching by showing, not by words. Not for
 * whoever prefers less motion (the line under the queue says it).
 */
function Coach({ recipe, src }: { recipe: string; src: string }) {
  const [path, setPath] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null)
  useEffect(() => {
    // once the sheet has come in and settled
    const t = window.setTimeout(() => {
      const a = document.querySelector(`[data-recipe="${recipe}"] .mp-recipe-pic`)?.getBoundingClientRect()
      const b = document.querySelector('.mp-places [data-kind="empty"]')?.getBoundingClientRect()
      if (a && b) setPath({ x: a.left + a.width / 2, y: a.top + a.height / 2, dx: b.left + b.width / 2 - (a.left + a.width / 2), dy: b.top + b.height / 2 - (a.top + a.height / 2) })
    }, 1100)
    return () => window.clearTimeout(t)
  }, [recipe])
  if (!path) return null
  const { dx, dy } = path
  return createPortal(
    <m.div
      className="mp-coach"
      aria-hidden="true"
      style={{ left: path.x, top: path.y }}
      initial={{ opacity: 0 }}
      animate={{ x: [0, 0, dx * 0.45, dx, dx], y: [0, -10, dy * 0.5 - 24, dy, dy], opacity: [0, 1, 1, 1, 0], scale: [0.8, 1.12, 1.12, 0.92, 0.8] }}
      transition={{ duration: 2.1, times: [0, 0.18, 0.55, 0.84, 1], ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.8 }}
    >
      <img src={src} alt="" draggable={false} />
      <HandGrabbing weight="fill" />
    </m.div>,
    document.body,
  )
}

/** Seconds running down, as the clock writes them. */
function Countdown({ left }: { left: number }) {
  return <b className="mp-count">{clock(useCountdown(left))}</b>
}
