import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { isNeighbour, talkerOf, type NeighbourId } from '../data/people'
import { TRACTOR } from '../farm/data'
import { heartsOf } from '../farm/people/friends'
import { farm, gateX, weatherNow, type Visitor } from '../farm/state'
import { tractorPose, type TractorPhase } from '../farm/tractorRoute'
import { debugSet } from '../lib/debug'
import type { TalkMoment } from './lines'
import { buyerTalker, DRIVER, heard, talk, talkNow, wireTalk } from './speech'

// The farm's people talking (./lines.ts, ./speech.ts), watched a few times a second: a buyer greets at their place in
// the line, thanks you when served and takes a no kindly; a neighbour in the line greets and thanks you in their own
// voice and words, more of them as their hearts grow; the man on the tractor says a few words as he loads, drives off
// and comes back, and a short sentence now and then. Each only maybe, near you, and never sooner than its wait
// (./rules.ts). Mounted with the farm's map (src/farm/Garden.tsx); the estate agent answers when you talk to him
// (src/farm/Estate.tsx).

/** The neighbour a buyer in line is (none: a stranger). */
const neighbourOf = (v: Visitor): NeighbourId | null => ('who' in v && isNeighbour(v.who) ? v.who : null)

/** A stranger's greeting in the rain or the snow, every other time (the rest: their usual hello). */
function skyWord(): 'buyer-rain' | 'buyer-snow' | null {
  const w = weatherNow()
  if (w.amount < 0.5 || Math.random() < 0.5) return null
  return w.kind === 'rain' ? 'buyer-rain' : w.kind === 'snow' ? 'buyer-snow' : null
}

/** A buyer's moment as they come to their place or go: a neighbour's own words, else a stranger's. */
function say(v: Visitor, moment: 'arrive' | 'thanks' | 'no') {
  const who = neighbourOf(v)
  if (!who) return talk(moment === 'arrive' ? (skyWord() ?? 'buyer-arrive') : `buyer-${moment}`, buyerTalker(v), v)
  // (a neighbour turned away says nothing: no is yours to say)
  if (moment !== 'no') talk(`${who}-${moment}`, talkerOf(who)!, v, heartsOf(farm.friends[who]?.points ?? 0))
}

/** How often the farm is looked at for moments (s). */
const EVERY = 0.4

export function FarmTalk() {
  const buyers = useRef(new Map<number, string>())
  const tractor = useRef<TractorPhase>('home')
  const since = useRef(0)
  useEffect(() => {
    debugSet('talk', { heard: () => heard.slice(), now: talkNow })
    return wireTalk()
  }, [])
  useFrame((_, dt) => {
    since.current += dt
    if (since.current < EVERY) return
    since.current = 0
    // the buyers: a moment each as their phase changes
    const seen = buyers.current
    for (const v of farm.visitors) {
      const was = seen.get(v.id)
      seen.set(v.id, v.phase)
      if (!was || v.phase === was) continue
      if (v.phase === 'queued') say(v, 'arrive')
      else if (v.phase === 'leaving' && v.mood !== 'neutral') say(v, v.mood === 'happy' ? 'thanks' : 'no')
    }
    for (const id of seen.keys()) if (!farm.visitors.some((v) => v.id === id)) seen.delete(id)
    // the driver: a word as each part of his trip begins (now and then a sentence instead, as he starts loading)
    const d = farm.dispatch
    const pose = d.trip < 0 ? null : tractorPose(d.trip, d.aboard, gateX())
    const phase: TractorPhase = pose?.phase ?? 'home'
    if (phase === tractor.current) return
    tractor.current = phase
    const at = pose ?? { x: TRACTOR.park, z: TRACTOR.z }
    const word: Partial<Record<TractorPhase, TalkMoment>> = { loading: 'driver-load', out: 'driver-go', back: 'driver-back' }
    const moment = word[phase]
    if (!moment) return
    if (phase !== 'loading' || !talk('driver-chat', DRIVER, at)) talk(moment, DRIVER, at)
  })
  return null
}
