import { animate, m, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useEffect } from 'react'
import { XP_FOR, type ProduceId } from '../../../src/farm/data'
import type { LevelView } from '../../../src/farm/levelView'
import { EASE } from '../../../src/ui/motion'

// What the level's card needs for the feeling of progress (lab/CRAFT.md, The feeling of progress), beside the game's
// LevelView: what was gained since the card was last open (the bar fills that part brighter: a small win seen), and
// what is ready on the farm now with the XP collecting it brings (a ghost on the bar: the next press, and how far it
// takes you). Neither is in the game yet: it would keep the XP the card showed last, and count what the compass has
// ready times XP_FOR. The numbers here are the game's own (XP_FOR), never made up.

export interface Ready {
  /** the good it is, for its picture */
  id: ProduceId
  /** how many there are (beds to harvest, eggs to collect) */
  n: number
  /** the XP collecting them all brings */
  xp: number
}

export interface LevelState extends LevelView {
  /** XP gained since the card was last open (missing in the game: the XP it showed last) */
  gain: number
  /** what waits on the farm now (missing in the game: the compass's ready marks × XP_FOR) */
  ready?: Ready
}

/** Beds of a crop ready to harvest: two XP a bed (gainXp('harvest', 1) per bed). */
export const beds = (id: ProduceId, n: number): Ready => ({ id, n, xp: n * XP_FOR.harvest })
/** Goods to collect from an animal: one XP each (gainXp('collect', n)). */
export const goods = (id: ProduceId, n: number): Ready => ({ id, n, xp: n * XP_FOR.collect })

/** The levels from the last garment's to the next garment's: the chapter the road shows (level 1 to 5 first). */
export function chapter(level: number) {
  const from = Math.max(1, Math.floor(level / 5) * 5)
  return { from, to: from === 1 ? 5 : from + 5 }
}

/** The time (0–1) at which an ease-out fill reaches `y` (0–1) of its way: for marks that light as the fill passes. */
export const reach = (y: number) => 1 - Math.cbrt(1 - Math.min(1, Math.max(0, y)))

/** A number that counts from `from` to `to`, starting after `delay` s (CountUp starts at once). */
export function Count({
  from,
  to,
  delay = 0,
  duration = 0.8,
  format = (n: number) => String(Math.round(n)),
}: {
  from: number
  to: number
  delay?: number
  duration?: number
  format?: (n: number) => string
}) {
  const still = useReducedMotion()
  const value = useMotionValue(still ? to : from)
  const text = useTransform(value, format)
  useEffect(() => {
    if (still) {
      value.set(to)
      return
    }
    value.set(from)
    const run = animate(value, to, { delay, duration, ease: EASE.out })
    return () => run.stop()
  }, [from, to, delay, duration, still, value])
  return <m.span>{text}</m.span>
}
