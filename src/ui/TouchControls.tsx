import { useEffect, useState, type CSSProperties } from 'react'
import { Joystick, VirtualButton } from 'ecctrl/input'
import { PICKUPS } from '../data/layout'
import { coarsePointer } from '../lib/device'
import { triggerInteraction } from '../lib/interaction'
import { busy, useHome, type Nearby } from '../store'
import { ActionFace, TurnHint, actionWord } from './ActionGlyph'

const PAD = 14 // gap to the screen edge, on top of the safe area (notches, gesture bar)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * Control sizes follow the screen — comfortable for a thumb, never a quarter of a small landscape screen — and
 * the layout follows the way the phone is held. The action button sits in the bottom-right corner under the
 * thumb with three places around it (above, above-left and left): upright, the jump button takes the place
 * to its left and the smaller actions go above, where an upright screen has room; on its side, the jump
 * button goes above and the smaller actions to the left, where a wide screen has room.
 */
function measure() {
  const w = window.innerWidth
  const h = window.innerHeight
  const short = Math.min(w, h)
  const landscape = w > h
  const stick = Math.round(clamp(short * 0.36, 112, 164)) // the joystick's touch area
  const main = Math.round(clamp(short * 0.22, 70, 92))
  const sat = Math.round(clamp(short * 0.15, 50, 62))
  const ring = main / 2 + 16 + sat / 2 // centre to centre
  return { stick, main, sat, ring, landscape }
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

const edge = (right: number, bottom: number): CSSProperties => ({
  right: `calc(${right}px + env(safe-area-inset-right))`,
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
 * On-screen joystick, jump button and action buttons — only on touch devices; the player reads the stick and jump
 * stores each frame. The big round button does what is in front of you or, when you look at nothing, the
 * nearest thing within reach (turning you towards it); the smaller ones around it do the next nearest things.
 */
export function TouchControls() {
  const phase = useHome((s) => s.phase)
  const occupied = useHome(busy)
  const actions = useHome((s) => s.actions)
  const carrying = useHome((s) => s.carrying)
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
  // controls; on its side, it sits between the stick and the action buttons
  useEffect(() => {
    if (!coarsePointer) return
    const root = document.documentElement
    const css = root.style
    const top = PAD + size.main / 2 + size.ring + size.sat / 2 // the top of the place above the action button
    const leftOfButtons = PAD + size.main / 2 + size.ring + size.sat / 2 // from the right edge
    css.setProperty('--touch-stick', `${size.stick}px`)
    css.setProperty('--touch-pad', `${PAD}px`)
    css.setProperty('--prompt-bottom', `${size.landscape ? PAD + 6 : Math.max(size.stick + PAD, top) + 12}px`)
    css.setProperty('--prompt-left', `${size.landscape ? size.stick + PAD * 2 : PAD}px`)
    css.setProperty('--prompt-right', `${size.landscape ? leftOfButtons + PAD : PAD}px`)
    root.dataset.orient = size.landscape ? 'landscape' : 'portrait'
  }, [size])

  if (!coarsePointer || phase !== 'playing' || occupied) return null

  const ringD = Math.round(size.stick * 0.62)
  const knob = Math.round(ringD * 0.48)
  const jumpSlot: Slot = size.landscape ? 'up' : 'left'
  const others: Slot[] = size.landscape ? ['left', 'upLeft'] : ['up', 'upLeft']
  const jumpAt = place(size, jumpSlot, size.sat + 14)
  const carried = PICKUPS.find((p) => p.id === carrying)
  const first: Nearby | null = actions[0] ?? (carried ? { id: 'drop', label: `Put down the ${carried.name}`, icon: { verb: 'drop' } } : null)

  return (
    <>
      <Joystick
        joystickMaxRadius={ringD / 2}
        joystickWrapperStyle={{
          left: `calc(${PAD}px + env(safe-area-inset-left))`,
          bottom: `calc(${PAD}px + env(safe-area-inset-bottom))`,
          width: size.stick,
          height: size.stick,
        }}
        joystickBaseStyle={{
          width: ringD,
          height: ringD,
          background: 'radial-gradient(circle, rgba(10, 13, 18, 0.12), rgba(10, 13, 18, 0.34))',
          border: '1.5px solid rgba(255, 255, 255, 0.6)',
          boxShadow: '0 4px 18px rgba(0, 0, 0, 0.28)',
        }}
        joystickKnobStyle={{
          width: knob,
          height: knob,
          background: 'rgba(255, 255, 255, 0.86)',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.35)',
        }}
      />
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
          fontWeight: 700,
          letterSpacing: '0.1em',
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        }}
      />
      {first && <ActionButton key="main" action={first} main size={size.main} at={{ right: PAD, bottom: PAD }} />}
      {actions.slice(1, 3).map((a, i) => (
        <ActionButton key={others[i]} action={a} size={size.sat} at={place(size, others[i], size.sat)} />
      ))}
    </>
  )
}
