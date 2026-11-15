import { useEffect, useState } from 'react'
import { hearNight } from '../audio/sound'
import { art } from '../ui/art'
import type { DayPhase } from './data'
import { clockFace, phaseDef } from './day'
import { dayNow } from './state'

// The farm's time in the row at the top (role G): the phase's picture (sunrise, sun, sunset, the moon) and the hour,
// as the farm's clocks show it (src/farm/day.ts, clockFace: the farm's ten minutes; the car's dashboard shows the same).

const NAMES: Record<DayPhase, string> = { morning: 'Morning', noon: 'Noon', evening: 'Evening', night: 'Night' }

// The garden's sounds ask the farm's clock whether it is night (no birds then, a few crickets instead): told here
// once, as the interface loads, so the sounds (src/audio/sound.ts) need not load the farm.
hearNight(() => dayNow().phase === 'night')

/** The phase's picture and the hour, on its own one-second timer. */
export function DayChip() {
  const [, setSecond] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSecond((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const { hour, phase } = dayNow()
  const time = clockFace(hour)
  return (
    <span className="farm-chip-item day" title={`${NAMES[phase]}, ${time}`}>
      <img src={art(phaseDef(phase).art)} alt={NAMES[phase]} />
      <b>{time}</b>
    </span>
  )
}
