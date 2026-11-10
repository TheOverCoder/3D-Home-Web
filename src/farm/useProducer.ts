import { useEffect } from 'react'
import { farmSound, placeSound } from '../audio/sound'
import { farmFx } from '../fx/fx'
import { playGesture } from '../lib/gestures'
import { registerInteractable, type InteractableDef } from '../lib/interaction'
import type { Point3 } from '../lib/playerState'
import { PRODUCERS, count, type ProducerId } from './data'
import { usePlacement } from './edit'
import { toWorld } from './layout'
import { animalName, collect, farm } from './state'

// What a producer offers on the action button (PRODUCERS in src/farm/data.ts): take what it holds — pick the lemons,
// collect the eggs, milk a cow, shear a sheep. The tree and the nest box stand in their places (useProducer); each cow
// and each sheep carries her own offer round with her (src/farm/Herd.tsx).

/** The offer to take what a producer holds (`i`: which animal, where each gives her own), from near `at.stand`,
 *  looking at `at.aim`. As it is taken: the gesture, its sound, a pop of sparkles in the good's colour, and `onCollect`
 *  (an animal stands still for a moment). */
export function producerOffer(id: ProducerId, i: number, at: { stand: Point3; aim: Point3 }, onCollect?: () => void): InteractableDef {
  const def = PRODUCERS[id]
  const n = () => farm.producers[id].stock[i] ?? 0
  const name = animalName(id, i)
  return {
    id: def.herd && !def.herd.shared ? `${def.action}-${i}` : def.action,
    position: at.stand,
    aim: at.aim,
    radius: def.reach,
    enabled: () => n() > 0,
    // full (no room for more), it goes on the compass: worth the walk
    ready: () => (n() >= def.max ? { item: def.good, count: n() } : null),
    label: () => (name ? `${def.word} ${name} · ${count(def.good, n())}` : `${def.word} ${count(def.good, n())}`),
    icon: () => ({ verb: def.verb, item: def.good, count: n() }),
    run: () => {
      collect(id, i)
      playGesture('interact')
      onCollect?.()
      const { pan, near } = placeSound(at.aim.x, at.aim.z)
      farmSound(def.sound, pan, near)
      farmFx('harvest', at.aim.x, def.sparkle, at.aim.z, { good: def.good })
    },
  }
}

/** A producer that stands in its place (the lemon tree, the nest box): its offer, where the place stands now. */
export function useProducer(id: ProducerId) {
  const p = usePlacement(PRODUCERS[id].place)
  useEffect(() => {
    const point = ([x, y, z]: [number, number, number]): Point3 => {
      const [wx, wz] = toWorld(p, x, z)
      return { x: wx, y, z: wz }
    }
    return registerInteractable(producerOffer(id, 0, { stand: point(PRODUCERS[id].stand), aim: point(PRODUCERS[id].aim) }))
  }, [id, p])
}
