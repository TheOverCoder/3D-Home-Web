import { useEffect, useRef } from 'react'
import { useHome } from '../store'
import { playerState, type Point3 } from './playerState'

export interface InteractableDef {
  id: string
  label: string | (() => string)
  position: Point3 // where you must stand near
  aim?: Point3 // what you look at in first person (defaults to `position`)
  radius: number
  enabled?: () => boolean
  run: () => void
}

const registry = new Map<string, InteractableDef>()

export function registerInteractable(def: InteractableDef) {
  registry.set(def.id, def)
  return () => {
    if (registry.get(def.id) === def) registry.delete(def.id)
  }
}

const labelOf = (def: InteractableDef) => (typeof def.label === 'function' ? def.label() : def.label)

/** Where the viewer's eyes are and which way they point (first person only). */
export interface ViewRay {
  origin: Point3
  dir: Point3
}

/** An interactable must be this close to the centre of the view (cos of the half-angle ≈ 37°). */
const AIM_COS = 0.8

/**
 * The interactable to offer. Third person: the nearest one inside its radius. First person: the one
 * you are looking at — within its radius and inside a narrow cone around the view direction, the most
 * centred first — so a screen behind you, or beside the notebook you are aiming at, is not offered.
 */
export function findNearest(from: Point3, view?: ViewRay): { id: string; label: string } | null {
  let best: InteractableDef | null = null
  let bestScore = Infinity
  for (const def of registry.values()) {
    if (def.enabled && !def.enabled()) continue
    const d = Math.hypot(def.position.x - from.x, def.position.y - from.y, def.position.z - from.z)
    if (d > def.radius) continue
    let score = d
    if (view) {
      const a = def.aim ?? def.position
      const vx = a.x - view.origin.x
      const vy = a.y - view.origin.y
      const vz = a.z - view.origin.z
      const len = Math.hypot(vx, vy, vz) || 1e-6
      const cos = (vx * view.dir.x + vy * view.dir.y + vz * view.dir.z) / len
      if (cos < AIM_COS) continue
      score = (1 - cos) * 10 + d * 0.1
    }
    if (score < bestScore) {
      best = def
      bestScore = score
    }
  }
  return best ? { id: best.id, label: labelOf(best) } : null
}

export function dropPosition(): [number, number, number] {
  const p = playerState.position
  const f = playerState.facing
  return [p.x + f.x * 0.9, p.y + 0.2, p.z + f.z * 0.9]
}

/** Runs whatever the player is currently standing next to; otherwise drops what they carry. */
export function triggerInteraction() {
  const { nearby, carrying, screen, settingsOpen, drop } = useHome.getState()
  if (screen || settingsOpen) return
  if (nearby) {
    registry.get(nearby.id)?.run()
    return
  }
  if (carrying) drop(dropPosition())
}

/** Registers an interactable for the lifetime of the component; `run`/`label` may close over fresh state. */
export function useInteractable(
  def: Omit<InteractableDef, 'position' | 'aim'> & { position: [number, number, number]; aim?: [number, number, number] },
) {
  const latest = useRef(def)
  latest.current = def
  const [x, y, z] = def.position
  const ax = def.aim?.[0]
  const ay = def.aim?.[1]
  const az = def.aim?.[2]
  useEffect(() => {
    const entry: InteractableDef = {
      id: def.id,
      position: { x, y, z },
      aim: ax === undefined || ay === undefined || az === undefined ? undefined : { x: ax, y: ay, z: az },
      radius: def.radius,
      label: () => {
        const l = latest.current.label
        return typeof l === 'function' ? l() : l
      },
      enabled: () => latest.current.enabled?.() ?? true,
      run: () => latest.current.run(),
    }
    return registerInteractable(entry)
  }, [def.id, def.radius, x, y, z, ax, ay, az])
}
