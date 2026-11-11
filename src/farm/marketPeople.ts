// The market's people: the manager behind his desk (until the shop is yours: then he walks out), the shoppers (in at
// the door, browsing the shelves, paying at the counter, out again) and the contractor at his cabin's window. Where
// each is, which way they face, whether they walk and in which pose comes from their movement scripts
// (src/farm/script.ts, through shoppersNow, managerNow and contractorNow in src/farm/state.ts); here they are only
// drawn: each on a rig of their own (src/models/person.ts), posed, and copied into the buyers' crowd (crowdGuests in
// src/farm/Visitors.tsx), so a person costs no draw of their own.

import { useEffect } from 'react'
import { MathUtils, type Group } from 'three'
import type { Parts } from '../lib/sculpt'
import { PersonRig, type PersonLook } from '../models/person'
import { contractorNow, managerNow, shoppersNow, type Walking } from './state'
import { crowdGuests } from './Visitors'

interface Body {
  rig: PersonRig
  look: PersonLook
  /** the hips' height standing still (the rig's own, from the look's height) */
  hips: number
  /** the stride's phase, from the ground walked */
  phase: number
  lastX: number
  lastZ: number
  /** the frame they were last drawn in (whoever is not drawn is forgotten) */
  seen: number
}

const damp = (o: Group, axis: 'x' | 'y' | 'z', to: number, dt: number, k = 10) => {
  o.rotation[axis] = MathUtils.damp(o.rotation[axis], to, k, dt)
}

/** One person posed as their script leaves them: walking (the legs and arms swing with the ground covered), browsing
 *  (looking along the shelves, a hand up to them now and then), paying (a hand held out over the counter), waving, or
 *  standing (breathing). */
function pose(b: Body, w: Walking, t: number, dt: number, seed: number) {
  const r = b.rig
  r.root.position.set(w.x, 0, w.z)
  r.root.rotation.y = w.heading
  const moved = Math.hypot(w.x - b.lastX, w.z - b.lastZ)
  b.lastX = w.x
  b.lastZ = w.z
  b.phase += moved * 5.2
  const walking = w.walking && moved > 1e-4
  const f = b.phase
  const amp = walking ? 0.55 : 0
  const browse = !walking && w.pose === 'browse'
  const pay = !walking && w.pose === 'pay'
  const wave = !walking && w.pose === 'wave'
  // browsing: a hand reaches to the shelf for a while, then rests
  const reach = browse && Math.sin(t * 0.9 + seed) > 0.35
  damp(r.thighL, 'x', -Math.sin(f) * amp, dt, 12)
  damp(r.thighR, 'x', Math.sin(f) * amp, dt, 12)
  damp(r.kneeL, 'x', Math.max(0, Math.cos(f)) * amp * 1.1 + 0.03, dt, 12)
  damp(r.kneeR, 'x', Math.max(0, -Math.cos(f)) * amp * 1.1 + 0.03, dt, 12)
  damp(r.armL, 'x', pay ? -1.05 : reach ? -1.25 : Math.sin(f) * amp * 0.7, dt)
  damp(r.armL, 'z', 0.06, dt)
  damp(r.elbowL, 'x', pay ? -0.55 : reach ? -0.35 : -0.12, dt)
  damp(r.armR, 'x', wave ? -2.7 : -Math.sin(f) * amp * 0.7, dt)
  damp(r.armR, 'z', wave ? -0.35 + Math.sin(t * 9) * 0.25 : -0.06, dt)
  damp(r.elbowR, 'x', wave ? -0.5 : -0.15, dt)
  // the head: along the shelves while browsing, down to the counter while paying
  damp(r.head, 'y', browse ? Math.sin(t * 0.7 + seed) * 0.45 : 0, dt, 4)
  damp(r.head, 'x', browse ? 0.12 : pay ? 0.22 : 0, dt, 6)
  const bob = walking ? Math.abs(Math.cos(f)) * 0.025 : 0
  const breathe = walking ? 0 : Math.sin(t * 1.6 + seed) * 0.004
  r.hips.position.y = b.hips + bob + breathe
}

/** Draws the market's people with the buyers' crowd, every frame, while mounted. */
export function useMarketPeople() {
  useEffect(() => {
    const bodies = new Map<string, Body>()
    let frame = 0
    let last = performance.now()
    const draw = (key: string, w: Walking, parts: Parts, t: number, dt: number, seed: number) => {
      let b = bodies.get(key)
      if (!b || b.look !== w.look) {
        const rig = new PersonRig(w.look)
        b = { rig, look: w.look, hips: rig.hips.position.y, phase: 0, lastX: w.x, lastZ: w.z, seen: frame }
        bodies.set(key, b)
      }
      b.seen = frame
      pose(b, w, t, dt, seed)
      b.rig.write(parts)
    }
    const guest = (parts: Parts) => {
      const now = performance.now()
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      frame++
      const t = now / 1000
      const manager = managerNow()
      if (manager) draw('manager', manager, parts, t, dt, 1)
      for (const s of shoppersNow()) draw(`shopper-${s.id}`, s, parts, t, dt, s.id * 1.7)
      const contractor = contractorNow()
      if (contractor) draw('contractor', contractor, parts, t, dt, 2)
      for (const [key, b] of bodies) if (b.seen !== frame) bodies.delete(key)
    }
    crowdGuests.add(guest)
    return () => void crowdGuests.delete(guest)
  }, [])
}
