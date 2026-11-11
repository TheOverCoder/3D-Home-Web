import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { VirtualButton, useJoystickStore } from 'ecctrl/input'
import { PICKUPS } from '../data/layout'
import { uiClick } from '../audio/sound'
import { coarsePointer } from '../lib/device'
import { triggerInteraction } from '../lib/interaction'
import { DEAD, RUN_AT, touchLayout, turnRound, useStick } from '../lib/stick'
import { stopWalk, useWalk } from '../lib/route/walking'
import { useSettings } from '../settings'
import { busy, useHome, type Nearby } from '../store'
import { ActionFace, TurnHint, actionWord } from './ActionGlyph'
import { ArrowULeftDown, NavigationArrow, PersonSimpleRun, PersonSimpleWalk } from './glyphs'

const PAD = 14 // gap to the screen edge, on top of the safe area (notches, gesture bar)
const TOOL = 44 // the round buttons over the stick
const TOOL_GAP = 8
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * Control sizes follow the screen — comfortable for a thumb, never a quarter of a small landscape screen — and
 * the layout follows the way the phone is held. The action button sits in the bottom-right corner under the
 * thumb with three places around it (above, above-left and left): upright, the jump button takes the place
 * to its left and the smaller actions go above, where an upright screen has room; on its side, the jump
 * button goes above and the smaller actions to the left, where a wide screen has room. The stick rests in the
 * bottom-left corner with a row of three round buttons over it (look where you walk, walk on, turn round), and comes
 * to wherever the thumb lands in the area round them.
 */
function measure() {
  const w = window.innerWidth
  const h = window.innerHeight
  const short = Math.min(w, h)
  const landscape = w > h
  const stick = Math.round(clamp(short * 0.36, 112, 164)) // the stick's place at rest
  const main = Math.round(clamp(short * 0.22, 70, 92))
  const sat = Math.round(clamp(short * 0.15, 50, 62))
  const ring = main / 2 + 16 + sat / 2 // centre to centre
  return { w, stick, main, sat, ring, landscape }
}
type Size = ReturnType<typeof measure>

const SLOTS = { up: Math.PI / 2, upLeft: (Math.PI * 3) / 4, left: Math.PI } as const
type Slot = keyof typeof SLOTS

/** Where a round control of `size` goes around the action button, measured from the bottom-right corner. */
function place(s: Size, slot: Slot, size: number) {
  const a = SLOTS[slot]
  const cx = PAD + s.main / 2 - Math.cos(a) * s.ring // from the right edge
  const cy = PAD + s.main / 2 + Math.sin(a) * s.ring // from the bottom edge
  return { right: cx - size / 2, bottom: cy - size / 2 }
}

/**
 * The left thumb's side: the stick's place at rest, the row of buttons over it, and the area where a thumb landing
 * brings the stick (from the corner, up to the row's top and across to the jump button upright — on its side, to
 * where the prompt starts). Also how far the action buttons reach, for what keeps clear of them.
 */
function leftSide(s: Size) {
  const row = 3 * TOOL + 2 * TOOL_GAP
  const toolsLeft = PAD + Math.max(0, (s.stick - row) / 2)
  const toolsBottom = PAD + s.stick + TOOL_GAP
  const top = toolsBottom + TOOL // the row's top, from the bottom edge
  const jump = s.sat + 14
  // the action buttons, from the right edge and the bottom edge
  const actionsLeft = PAD + s.main / 2 + s.ring + (s.landscape ? s.sat : jump) / 2
  const actionsTop = PAD + s.main / 2 + s.ring + (s.landscape ? jump : s.sat) / 2
  const zoneW = Math.round(s.landscape ? Math.max(PAD + s.stick, toolsLeft + row) + PAD / 2 : Math.min(s.w / 2, s.w - actionsLeft - 10))
  return { toolsLeft, toolsBottom, top, zoneW, zoneH: Math.round(top + 6), actionsLeft, actionsTop }
}

const edge = (right: number, bottom: number): CSSProperties => ({
  right: `calc(${right}px + env(safe-area-inset-right))`,
  bottom: `calc(${bottom}px + env(safe-area-inset-bottom))`,
})
const edgeLeft = (left: number, bottom: number): CSSProperties => ({
  left: `calc(${left}px + env(safe-area-inset-left))`,
  bottom: `calc(${bottom}px + env(safe-area-inset-bottom))`,
})

function ActionButton({ action, main, size, at }: { action: Nearby; main?: boolean; size: number; at: { right: number; bottom: number } }) {
  return (
    <button
      className={`act-btn${main ? ' main' : ''}`}
      data-verb={action.icon?.verb ?? 'pick'}
      style={{ ...edge(at.right, at.bottom), width: size, height: size }}
      aria-label={action.label}
      onClick={() => (main ? triggerInteraction() : triggerInteraction(action.id))}
      onContextMenu={(e) => e.preventDefault()}
    >
      <ActionFace icon={action.icon} />
      <span className="act-word">{actionWord(action.icon, action.label)}</span>
      {action.reach && <TurnHint side={action.side} className={`act-turn ${action.side}`} />}
    </button>
  )
}

/**
 * The stick. It rests in the bottom-left corner, and comes to wherever the thumb lands in the area round it, so the
 * first touch never pushes it by itself; a quiet middle (a thumb settling) does nothing, and past the ring on its
 * base it runs — the ring lights up and the knob shows a runner. Taking it stops walking on by itself, and walking to a
 * compass mark. It writes ecctrl's stick store, which the player reads every frame.
 */
function Stick({ size }: { size: Size }) {
  const side = leftSide(size)
  const base = Math.round(size.stick * 0.62)
  const r = base / 2 // how far the knob goes
  const knob = Math.round(base * 0.48)
  const home = { x: PAD + size.stick / 2, y: side.zoneH - PAD - size.stick / 2 } // the middle at rest, in the area
  const zone = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const knobEl = useRef<HTMLDivElement>(null)
  // the finger holding it, the middle it came to (in the area) and where the area is on the screen
  const held = useRef<{ id: number; x: number; y: number; left: number; top: number } | null>(null)

  const show = (x: number, y: number, dx: number, dy: number, state: 'rest' | 'walk' | 'run') => {
    const el = ring.current
    if (el) {
      el.style.transform = `translate(${x - r}px, ${y - r}px)`
      el.dataset.state = state
    }
    if (knobEl.current) knobEl.current.style.transform = `translate(${dx}px, ${dy}px)`
  }
  const release = () => {
    held.current = null
    useJoystickStore.getState().resetJoystick()
    show(home.x, home.y, 0, 0, 'rest')
  }
  const move = (e: PointerEvent) => {
    const h = held.current
    if (!h || h.id !== e.pointerId) return
    let dx = e.clientX - h.left - h.x
    let dy = e.clientY - h.top - h.y
    const d = Math.hypot(dx, dy)
    if (d > r) {
      dx *= r / d
      dy *= r / d
    }
    const push = Math.min(1, d / r)
    show(h.x, h.y, dx, dy, push > RUN_AT ? 'run' : 'walk')
    if (push < DEAD) useJoystickStore.getState().setJoystick(0, 0)
    else useJoystickStore.getState().setJoystick(dx / r, -dy / r)
  }

  // nothing held over when the controls go (a panel opened)
  useEffect(() => () => useJoystickStore.getState().resetJoystick(), [])

  return (
    <div
      ref={zone}
      className="stick-zone"
      style={{ ...edgeLeft(0, 0), width: side.zoneW, height: side.zoneH }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.preventDefault()
        if (held.current) return // a second finger: the first one keeps it
        const box = zone.current!.getBoundingClientRect()
        // where the thumb landed, kept far enough in that the whole base is on the screen
        const x = Math.max(r + 4, e.clientX - box.left)
        const y = Math.min(side.zoneH - r - 4, e.clientY - box.top)
        held.current = { id: e.pointerId, x, y, left: box.left, top: box.top }
        e.currentTarget.setPointerCapture(e.pointerId)
        useStick.getState().setCruise(false)
        stopWalk('stick')
        move(e)
      }}
      onPointerMove={move}
      onPointerUp={(e) => held.current?.id === e.pointerId && release()}
      onPointerCancel={(e) => held.current?.id === e.pointerId && release()}
      onLostPointerCapture={(e) => held.current?.id === e.pointerId && release()}
    >
      {/* at rest where it belongs; held, moved straight on the page (no render for every move of the thumb) */}
      <div
        ref={ring}
        className="stick-base"
        style={{ width: base, height: base, transform: `translate(${home.x - r}px, ${home.y - r}px)`, ['--run' as string]: `${Math.round(r * (1 - RUN_AT))}px` }}
        data-state="rest"
      >
        <div ref={knobEl} className="stick-knob" style={{ width: knob, height: knob, margin: -knob / 2, transform: 'translate(0px, 0px)' }}>
          <PersonSimpleRun weight="fill" className="stick-runner" />
        </div>
      </div>
    </div>
  )
}

/** The row of round buttons over the stick: the view turns where you walk (on or off, remembered), walk on by
 *  yourself (until you take the stick; it shows pressed while you walk to a compass mark too, and then stops that), and
 *  turn round. */
function StickTools({ size }: { size: Size }) {
  const side = leftSide(size)
  const follow = useSettings((s) => s.followMove)
  const cruise = useStick((s) => s.cruise)
  const walking = useWalk((s) => s.id !== null)
  const at = (i: number) => ({ ...edgeLeft(side.toolsLeft + i * (TOOL + TOOL_GAP), side.toolsBottom), width: TOOL, height: TOOL })
  return (
    <>
      <button
        className="stick-tool"
        style={at(0)}
        aria-pressed={follow}
        aria-label="Look where you walk"
        onClick={() => {
          uiClick()
          useSettings.getState().update({ followMove: !follow })
          useHome.getState().showToast(follow ? 'The view stays where you look' : 'The view turns where you walk')
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <NavigationArrow weight={follow ? 'fill' : 'bold'} />
      </button>
      <button
        className="stick-tool"
        style={at(1)}
        aria-pressed={cruise || walking}
        aria-label="Walk on by yourself"
        onClick={() => {
          uiClick()
          if (walking) stopWalk('button')
          else useStick.getState().setCruise(!cruise)
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <PersonSimpleWalk weight={cruise || walking ? 'fill' : 'bold'} />
      </button>
      <button
        className="stick-tool"
        style={at(2)}
        aria-label="Turn round"
        onClick={() => {
          uiClick()
          turnRound()
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <ArrowULeftDown weight="bold" />
      </button>
    </>
  )
}

/**
 * On-screen stick, its buttons, the jump button and the action buttons — only on touch devices; the player reads the
 * stick and jump stores each frame. The big round button does what is in front of you or, when you look at nothing,
 * the nearest thing within reach (turning you towards it); the smaller ones around it do the next nearest things.
 */
export function TouchControls() {
  const phase = useHome((s) => s.phase)
  const occupied = useHome(busy)
  const actions = useHome((s) => s.actions)
  const carrying = useHome((s) => s.carrying)
  const asking = useHome((s) => s.confirm !== null)
  const [size, setSize] = useState(measure)

  useEffect(() => {
    if (!coarsePointer) return
    const update = () => setSize(measure())
    const portrait = matchMedia('(orientation: portrait)')
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    portrait.addEventListener?.('change', update)
    window.visualViewport?.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      portrait.removeEventListener?.('change', update)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [])

  // the HUD keeps clear of the controls (styles.css reads these): upright, the action label goes above all the
  // controls; on its side, it sits between the stick and the action buttons. The tag on a thing keeps clear too.
  useEffect(() => {
    if (!coarsePointer) return
    const root = document.documentElement
    const css = root.style
    const side = leftSide(size)
    const bottom = size.landscape ? PAD + 6 : Math.max(side.top, side.actionsTop) + 12
    css.setProperty('--touch-stick', `${size.stick}px`)
    css.setProperty('--touch-main', `${size.main}px`)
    css.setProperty('--touch-pad', `${PAD}px`)
    css.setProperty('--prompt-bottom', `${bottom}px`)
    css.setProperty('--prompt-left', `${size.landscape ? side.zoneW + 6 : PAD}px`)
    css.setProperty('--prompt-right', `${size.landscape ? side.actionsLeft + PAD : PAD}px`)
    root.dataset.orient = size.landscape ? 'landscape' : 'portrait'
    touchLayout.left = { w: side.zoneW, h: side.top }
    touchLayout.right = { w: side.actionsLeft, h: side.actionsTop }
    touchLayout.prompt = bottom + 52
  }, [size])

  if (!coarsePointer || phase !== 'playing' || occupied) return null

  const jumpSlot: Slot = size.landscape ? 'up' : 'left'
  const others: Slot[] = size.landscape ? ['left', 'upLeft'] : ['up', 'upLeft']
  const jumpAt = place(size, jumpSlot, size.sat + 14)
  const carried = PICKUPS.find((p) => p.id === carrying)
  const first: Nearby | null = actions[0] ?? (carried ? { id: 'drop', label: `Put down the ${carried.name}`, icon: { verb: 'drop' } } : null)

  return (
    <>
      <Stick size={size} />
      <StickTools size={size} />
      <VirtualButton
        id="jump"
        label="JUMP"
        buttonWrapperStyle={{
          ...edge(jumpAt.right, jumpAt.bottom),
          width: size.sat + 14,
          height: size.sat + 14,
          background: 'transparent',
        }}
        buttonCapStyle={{
          width: size.sat,
          height: size.sat,
          background: 'rgba(12, 15, 21, 0.5)',
          border: '1.5px solid rgba(255, 255, 255, 0.5)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
          color: '#fff',
          fontSize: 11,
          letterSpacing: '0.1em',
          fontFamily: "'Fredoka Variable', ui-rounded, system-ui, sans-serif",
          fontWeight: 600,
        }}
      />
      {first && <ActionButton key="main" action={first} main size={size.main} at={{ right: PAD, bottom: PAD }} />}
      {/* while a machine asks (its card sits over the button), only the button itself, which closes the card */}
      {!asking && actions.slice(1, 3).map((a, i) => <ActionButton key={others[i]} action={a} size={size.sat} at={place(size, others[i], size.sat)} />)}
    </>
  )
}
