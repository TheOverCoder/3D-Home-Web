import { create } from 'zustand'
import { useHome } from '../../store'
import { look, lookedAt, turning } from '../look'
import { useStick } from '../stick'

// Walking by yourself to a mark tapped on the compass (src/ui/Compass.tsx): what is walked to, and how it ends. The
// walk itself (finding the way, steering the stick) is src/lib/route/walker.ts, run by the player every frame; this is
// the small part the interface needs (no three.js, no physics), so the page shell can show it.

export interface WalkState {
  /** the interactable walked to (null: not walking), and the good its compass mark shows (that mark is highlighted) */
  id: string | null
  item: string | null
  /** each tap starts a new walk, even to the same thing */
  seq: number
  /** how the last walk ended: 'arrived', or what stopped it — you ('stick', 'key', 'jump', 'busy' for a panel or a card
   *  or an edit mode, 'again' for the mark, 'button' for the walk-on button, 'used' for the action button), or the way
   *  ('blocked' held up twice, 'no-way', 'gone' the thing went, 'moved' you were put elsewhere, 'slow' far too long) */
  ended: string | null
}

export const useWalk = create<WalkState>()(() => ({ id: null, item: null, seq: 0, ended: null }))

/** The stick as walking by itself pushes it this frame: in the view's frame (x to the right, y ahead), and whether it
 *  runs. The player reads it as it reads the touch stick (src/scene/Player.tsx); `on` false when not walking. */
export const walkStick = { on: false, x: 0, y: 0, run: false }

/** What the last walks cost, for the tests and ?debug (`window.__home.walk.stats`). */
export const walkStats = {
  grids: 0,
  /** the last grid's questions to the physics world */
  probes: 0,
  capsules: 0,
  blocks: 0,
  probeMs: 0,
  /** the last way found: cells taken off the queue, milliseconds over how many frames, its length (m) and turns */
  expanded: 0,
  planMs: 0,
  planFrames: 0,
  slowestFrameMs: 0,
  length: 0,
  turns: 0,
  replans: 0,
  /** the walk so far: seconds, metres, frames and the longest step in one frame (m) */
  seconds: 0,
  walked: 0,
  frames: 0,
  longestStep: 0,
  /** the fastest the view turned by itself towards the way (radians a second, first person) */
  fastestTurn: 0,
}

/** Which way the walk is heading (a look yaw), for the view to turn towards in first person; null when not walking. */
export const walkHeading = { yaw: null as number | null }

/**
 * A compass mark tapped: walk there by yourself (the mark's arrow over the thing in the world, as before). The same
 * mark again — the same thing, or the same kind of good — stops.
 */
export function walkTo(id: string, item: string | null = null) {
  const s = useWalk.getState()
  if (s.id && (s.id === id || (item !== null && s.item === item))) {
    stopWalk('again')
    useHome.getState().setGuide(null)
    return
  }
  useStick.getState().setCruise(false)
  useHome.getState().setGuide(id)
  useWalk.setState({ id, item, seq: s.seq + 1, ended: null })
}

/** Stops walking by itself (you took over, or it got there); the thing stays marked a while if you did not arrive. */
export function stopWalk(why: string) {
  const s = useWalk.getState()
  walkStick.on = false
  walkHeading.yaw = null
  if (!s.id) return
  // the arrow over it stays a little longer, counted from now
  const guide = useHome.getState().guide
  if (why !== 'arrived' && guide?.id === s.id) useHome.getState().setGuide(s.id)
  useWalk.setState({ id: null, item: null, ended: why })
}

/** Whether it is walking to this thing now. */
export const walkingTo = (id: string) => useWalk.getState().id === id

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const MAX_RATE = 1.4 // radians a second, at most (about 80°: as fast as the view that follows the stick)
const turn = { rate: 0 }

/**
 * First person, walking by itself: the view turns towards where the walk heads, eased in and out like the view that
 * follows the stick (never a snap), and comes level if you were looking up or down. It waits while you look round
 * yourself, and while the game turns you to something. Called by the camera every frame.
 */
export function stepWalkView(dt: number) {
  let want = 0
  let off = 0
  const yaw = walkHeading.yaw
  const free = yaw !== null && !turning() && performance.now() - lookedAt.time > 600
  if (free) {
    off = wrap(yaw - look.yaw)
    want = Math.max(-MAX_RATE, Math.min(MAX_RATE, off * 2.4))
    look.pitch += (-0.06 - look.pitch) * (1 - Math.exp(-dt * 1.2))
  }
  turn.rate += (want - turn.rate) * (1 - Math.exp(-Math.min(dt, 0.5) / 0.2))
  if (want === 0 && Math.abs(turn.rate) < 1e-3) turn.rate = 0
  let step = turn.rate * Math.min(dt, 0.5)
  // never past where it heads (a slow frame is a long step)
  if (free && Math.abs(step) > Math.abs(off)) step = off
  look.yaw += step
  if (dt > 0) walkStats.fastestTurn = Math.max(walkStats.fastestTurn, Math.abs(step) / dt)
}
