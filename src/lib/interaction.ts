import { useEffect, useRef } from 'react'
import { useHome } from '../store'
import { playerState, type Point3 } from './playerState'

export interface InteractableDef {
  id: string
  label: string | (() => string)
  position: Point3
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

export function findNearest(from: Point3): { id: string; label: string } | null {
  let best: InteractableDef | null = null
  let bestDist = Infinity
  for (const def of registry.values()) {
    if (def.enabled && !def.enabled()) continue
    const d = Math.hypot(def.position.x - from.x, def.position.y - from.y, def.position.z - from.z)
    if (d <= def.radius && d < bestDist) {
      best = def
      bestDist = d
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
  const { nearby, carrying, screen, drop } = useHome.getState()
  if (screen) return
  if (nearby) {
    registry.get(nearby.id)?.run()
    return
  }
  if (carrying) drop(dropPosition())
}

/** Registers an interactable for the lifetime of the component; `run`/`label` may close over fresh state. */
export function useInteractable(def: Omit<InteractableDef, 'position'> & { position: [number, number, number] }) {
  const latest = useRef(def)
  latest.current = def
  const [x, y, z] = def.position
  useEffect(() => {
    const entry: InteractableDef = {
      id: def.id,
      position: { x, y, z },
      radius: def.radius,
      label: () => {
        const l = latest.current.label
        return typeof l === 'function' ? l() : l
      },
      enabled: () => latest.current.enabled?.() ?? true,
      run: () => latest.current.run(),
    }
    return registerInteractable(entry)
  }, [def.id, def.radius, x, y, z])
}
