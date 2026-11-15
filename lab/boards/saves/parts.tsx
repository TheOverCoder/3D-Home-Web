import { m, useAnimate, useReducedMotion } from 'motion/react'
import { useRef, useState, type ReactNode } from 'react'
import type { Slot } from '../../../src/farm/state'
import { art } from '../../../src/ui/art'
import { EASE } from '../../../src/ui/motion'
import { big, emptyFarm, evening, savedAgo, small, type Farm } from '../intro/data'
import './parts.css'

// What the save list's three looks share: its states (the farms as the save list reads them, from the opening
// screen's board: lab/boards/intro/data.ts), what a press does to them, and the one button that clears a farm — held,
// not tapped: a fill runs round it while the finger stays, and only a full hold starts the farm afresh (a slip of the
// finger never loses a farm). Every rule under .v-saves.

export interface SavesState {
  /** the farm being played */
  playing: Slot
  farms: Farm[]
}

const at = (f: Farm, slot: Slot): Farm => ({ ...f, slot })

export const STATES: { id: string; name: string; data: SavesState }[] = [
  { id: 'one', name: 'חווה אחת, ושני מקומות ריקים', data: { playing: 1, farms: [evening, emptyFarm(2), emptyFarm(3)] } },
  { id: 'three', name: 'שלוש חוות', data: { playing: 2, farms: [small, big, at(evening, 3)] } },
  { id: 'new', name: 'שחקן חדש: הכל ריק', data: { playing: 1, farms: [emptyFarm(1), emptyFarm(2), emptyFarm(3)] } },
]

/** A farm started afresh: empty in its place. */
export const clear = (s: SavesState, slot: Slot): SavesState => ({ ...s, farms: s.farms.map((f) => (f.slot === slot ? emptyFarm(slot) : f)) })
export const play = (s: SavesState, slot: Slot): SavesState => ({ ...s, playing: slot })

export { savedAgo }

/** The farm's picture: its house, or a seedling for an empty place. */
export const FarmArt = ({ f, className = '' }: { f: Farm; className?: string }) => <img className={`art ${className}`} src={art(f.exists ? 'house-with-garden' : 'seedling')} alt="" />

/** Its level: the game's star with the number on it. */
export const Star = ({ level }: { level: number }) => (
  <span className="v-saves-star" aria-label={`Level ${level}`}>
    <img className="art" src={art('glowing-star')} alt="" />
    <b>{level}</b>
  </span>
)

/**
 * Hold to start a farm afresh: a fill runs across the button while the finger stays on it (1.2 s), and lets go back if
 * it lifts early. Reduced motion: the same hold, the fill without its glide.
 */
export function HoldToClear({ onDone, label, children }: { onDone: () => void; label: string; children: ReactNode }) {
  const [scope, animate] = useAnimate<HTMLButtonElement>()
  const still = useReducedMotion()
  const [held, setHeld] = useState(false)
  const run = useRef<ReturnType<typeof animate> | null>(null)
  const start = () => {
    setHeld(true)
    const r = animate('.v-saves-hold-fill', { scaleX: [0, 1] }, { duration: 1.2, ease: 'linear' })
    run.current = r
    void r.then(() => {
      // a full hold (a hold let go early is stopped, and never gets here as the one running)
      if (run.current !== r || !scope.current) return
      run.current = null
      setHeld(false)
      onDone()
    })
  }
  const stop = () => {
    if (!held) return
    const r = run.current
    run.current = null
    r?.stop()
    setHeld(false)
    void animate('.v-saves-hold-fill', { scaleX: 0 }, { duration: still ? 0 : 0.25, ease: EASE.out })
  }
  return (
    <m.button
      ref={scope}
      className={`btn soft v-saves-hold${held ? ' held' : ''}`}
      aria-label={label}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !held && start()}
      onKeyUp={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="v-saves-hold-fill" aria-hidden="true" />
      <span className="v-saves-hold-words">{held ? 'Keep holding…' : children}</span>
    </m.button>
  )
}
