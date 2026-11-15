// The market's people: the manager behind his desk (until the shop is yours: then he walks out), the shoppers (in at
// the door, browsing the shelves, paying at the counter, out again), the contractor at his cabin's window, and the
// estate agent at his desk in the office beside the market (he sits; he looks up at you when you come in). Where each
// is, which way they face, whether they walk and in which pose comes from their movement scripts (src/farm/script.ts,
// through shoppersNow, managerNow, contractorNow and estateAgentNow in src/farm/state.ts); here they are only drawn:
// each on a rig of their own (src/models/person.ts), posed, and copied into the buyers' crowd (crowdGuests in
// src/farm/Visitors.tsx), so a person costs no draw of their own.

import { useEffect } from 'react'
import { MathUtils, type Group } from 'three'
import type { Parts } from '../lib/sculpt'
import { SEAT_Y } from '../data/estate'
import { playerState } from '../lib/playerState'
import { PersonRig, SITTING, type PersonLook } from '../models/person'
import { contractorNow, estateAgentNow, managerNow, shoppersNow, type Walking } from './state'
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

/** How near you come before someone sitting at a desk looks up at you (m), and how far round they turn their head. */
const LOOK_AT_YOU = 3.5
const LOOK_ROUND = 0.7

/** One person posed as their script leaves them: walking (the legs and arms swing with the ground covered), browsing
 *  (looking along the shelves, a hand up to them now and then), paying (a hand held out over the counter), waving,
 *  sitting at a desk (SITTING: the forearms on it; looking up at you when you are near) or standing (breathing). */
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
  const sit = !walking && w.pose === 'sit'
  // browsing: a hand reaches to the shelf for a while, then rests
  const reach = browse && Math.sin(t * 0.9 + seed) > 0.35
  const S = SITTING
  damp(r.thighL, 'x', sit ? S.thigh : -Math.sin(f) * amp, dt, 12)
  damp(r.thighR, 'x', sit ? S.thigh : Math.sin(f) * amp, dt, 12)
  damp(r.thighL, 'z', sit ? S.thighOut : 0, dt, 12)
  damp(r.thighR, 'z', sit ? -S.thighOut : 0, dt, 12)
  damp(r.kneeL, 'x', sit ? S.knee : Math.max(0, Math.cos(f)) * amp * 1.1 + 0.03, dt, 12)
  damp(r.kneeR, 'x', sit ? S.knee : Math.max(0, -Math.cos(f)) * amp * 1.1 + 0.03, dt, 12)
  damp(r.armL, 'x', sit ? S.arm : pay ? -1.05 : reach ? -1.25 : Math.sin(f) * amp * 0.7, dt)
  damp(r.armL, 'z', sit ? S.armOut : 0.06, dt)
  damp(r.elbowL, 'x', sit ? S.elbow : pay ? -0.55 : reach ? -0.35 : -0.12, dt)
  damp(r.armR, 'x', sit ? S.arm : wave ? -2.7 : -Math.sin(f) * amp * 0.7, dt)
  damp(r.armR, 'z', sit ? -S.armOut : wave ? -0.35 + Math.sin(t * 9) * 0.25 : -0.06, dt)
  damp(r.elbowR, 'x', sit ? S.elbow : wave ? -0.5 : -0.15, dt)
  // the head: along the shelves while browsing, down to the counter while paying; sitting, down at the desk, and up at
  // you when you come near
  let look = browse ? Math.sin(t * 0.7 + seed) * 0.45 : 0
  if (sit) {
    const p = playerState.position
    const near = Math.hypot(p.x - w.x, p.z - w.z) < LOOK_AT_YOU
    const toYou = Math.atan2(Math.sin(Math.atan2(p.x - w.x, p.z - w.z) - w.heading), Math.cos(Math.atan2(p.x - w.x, p.z - w.z) - w.heading))
    look = near ? Math.max(-LOOK_ROUND, Math.min(LOOK_ROUND, toYou)) : Math.sin(t * 0.35 + seed) * 0.2
    damp(r.head, 'x', near ? 0 : 0.2, dt, 4)
  } else damp(r.head, 'x', browse ? 0.12 : pay ? 0.22 : 0, dt, 6)
  damp(r.head, 'y', look, dt, 4)
  const bob = walking ? Math.abs(Math.cos(f)) * 0.025 : 0
  const breathe = walking ? 0 : Math.sin(t * 1.6 + seed) * 0.004
  // sitting down and getting up: the hips go down onto the seat (and a little forward) and up again, not at once
  const hipsY = sit ? SEAT_Y + S.hips + breathe : b.hips + bob + breathe
  r.hips.position.y = sit || r.hips.position.y < b.hips - 0.03 ? MathUtils.damp(r.hips.position.y, hipsY, 10, dt) : hipsY
  r.hips.position.z = MathUtils.damp(r.hips.position.z, sit ? S.forward : 0, 10, dt)
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
      const agent = estateAgentNow()
      if (agent) draw('agent', agent, parts, t, dt, 3)
      for (const [key, b] of bodies) if (b.seen !== frame) bodies.delete(key)
    }
    crowdGuests.add(guest)
    return () => void crowdGuests.delete(guest)
  }, [])
}
