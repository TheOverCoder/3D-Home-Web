import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { TRACTOR } from '../farm/data'
import { farm, gateX } from '../farm/state'
import { tractorPose, type TractorPhase } from '../farm/tractorRoute'
import { debugSet } from '../lib/debug'
import { LONG_WAIT, type TalkMoment } from './lines'
import { buyerTalker, DRIVER, heard, talk, talkNow, wireTalk } from './speech'

// The farm's people talking (./lines.ts, ./speech.ts), watched a few times a second: a buyer greets at their place in
// the line, thanks you when served, says a word when turned away and sighs after a long wait; the man on the tractor
// says a few words as he loads, drives off and comes back, and a short sentence now and then. Each only maybe, near
// you, and never sooner than its wait (./rules.ts). Mounted with the farm's map (src/farm/Garden.tsx); the estate
// agent answers when you talk to him (src/farm/Estate.tsx).

/** How often the farm is looked at for moments (s). */
const EVERY = 0.4

export function FarmTalk() {
  const buyers = useRef(new Map<number, { phase: string; since: number; sighed: boolean }>())
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
    // the buyers: a moment each as their phase changes, a sigh once after a long wait
    const seen = buyers.current
    for (const v of farm.visitors) {
      const was = seen.get(v.id)
      if (!was) {
        seen.set(v.id, { phase: v.phase, since: farm.clock, sighed: false })
        continue
      }
      if (v.phase !== was.phase) {
        was.phase = v.phase
        if (v.phase === 'queued') {
          was.since = farm.clock
          talk('buyer-arrive', buyerTalker(v), v)
        } else if (v.phase === 'leaving' && v.mood !== 'neutral') talk(v.mood === 'happy' ? 'buyer-thanks' : 'buyer-no', buyerTalker(v), v)
      } else if (v.phase === 'queued' && !was.sighed && farm.clock - was.since >= LONG_WAIT) {
        was.sighed = true
        talk('buyer-wait', buyerTalker(v), v)
      }
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
