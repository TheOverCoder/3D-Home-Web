// First-person view direction. Plain numbers so the entry chunk can import it without three.js.
// Camera forward is (-sin(yaw)·cos(pitch), sin(pitch), -cos(yaw)·cos(pitch)); yaw = PI looks south (+z).
import type { Point3 } from './playerState'

export const look = { yaw: Math.PI, pitch: -0.04 }

const LIMIT = 1.45
/** A turn the game makes for you — towards something you chose to use — eased over a moment. Your own look input cancels it. */
let turn: { yaw: number; pitch: number } | null = null

export function addLook(dx: number, dy: number, sensitivity = 0.0022) {
  if (Math.abs(dx) + Math.abs(dy) >= 3) turn = null // a real move of the mouse or finger, not a tremor
  look.yaw -= dx * sensitivity
  look.pitch = Math.max(-LIMIT, Math.min(LIMIT, look.pitch - dy * sensitivity))
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

/** Starts turning the view from `eye` towards `target` (the short way round). */
export function turnTowards(eye: Point3, target: Point3) {
  const dx = target.x - eye.x
  const dz = target.z - eye.z
  if (Math.hypot(dx, dz) < 1e-3) return
  const yaw = Math.atan2(-dx, -dz)
  const pitch = Math.max(-1.0, Math.min(0.6, Math.atan2(target.y - eye.y, Math.hypot(dx, dz))))
  turn = { yaw: look.yaw + wrap(yaw - look.yaw), pitch }
}

/** Advances a turn in progress; called by the camera every frame. */
export function stepTurn(dt: number) {
  if (!turn) return
  const k = 1 - Math.exp(-dt * 10)
  look.yaw += (turn.yaw - look.yaw) * k
  look.pitch += (turn.pitch - look.pitch) * k
  if (Math.abs(turn.yaw - look.yaw) < 0.003 && Math.abs(turn.pitch - look.pitch) < 0.003) {
    look.yaw = turn.yaw
    look.pitch = turn.pitch
    turn = null
  }
}

export const turning = () => turn !== null

/** Drops a turn in progress (a teleport: the view is set afresh). */
export function stopTurn() {
  turn = null
}
