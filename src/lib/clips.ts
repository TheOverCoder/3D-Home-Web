import type { EcctrlAnimationState } from 'ecctrl/animation'
import type { Gesture } from './gestures'

// Clip names differ between animation packs, so clips are found by pattern (first rule wins).
// Quaternius' Universal Animation Library uses names such as Idle_Loop, Walk_Loop, Jog_Fwd_Loop,
// Sprint_Loop, Jump_Start, Jump_Loop, Jump_Land; Mixamo-style names (Idle, Walking, Running) also match.
export const CLIP_RULES: Record<EcctrlAnimationState, RegExp[]> = {
  IDLE: [/^idle_loop$/i, /^idle$/i, /idle/i],
  WALK: [/^walk_loop$/i, /^walk(ing)?$/i, /walk/i],
  RUN: [/^jog_fwd_loop$/i, /^run(ning)?$/i, /^sprint_loop$/i, /jog|run|sprint/i],
  JUMP_START: [/^jump_start$/i, /jump.*start/i, /^jump$/i],
  JUMP_IDLE: [/^jump_loop$/i, /jump.*(loop|idle)/i, /fall/i],
  JUMP_FALL: [/^fall(ing)?_?loop$/i, /fall/i, /^jump_loop$/i],
  JUMP_LAND: [/^jump_land$/i, /land/i],
}

export const GESTURE_RULES: Record<Gesture, RegExp[]> = {
  interact: [/^interact$/i, /interact/i, /press|button/i],
  pickup: [/pick.?up/i, /^interact$/i, /grab|reach/i],
}

export const ONE_SHOT: ReadonlySet<EcctrlAnimationState> = new Set(['JUMP_START', 'JUMP_LAND'])

export function pickClip(names: readonly string[], rules: readonly RegExp[]): string | undefined {
  for (const rule of rules) {
    const hit = names.find((n) => rule.test(n))
    if (hit) return hit
  }
  return undefined
}
