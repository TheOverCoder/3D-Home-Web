import { useEffect, useState } from 'react'
import { hearNight } from '../audio/sound'
import { art } from '../ui/art'
import type { DayPhase } from './data'
import { phaseDef } from './day'
import { dayNow } from './state'

// The farm's time in the row at the top (role G): the phase's picture (sunrise, sun, sunset, the moon) and the hour.
// A farm day is DAY.length real seconds (src/farm/day.ts), so the clock shows the farm's ten minutes: it moves on
// every few seconds, never a flicker of digits.

const NAMES: Record<DayPhase, string> = { morning: 'Morning', noon: 'Noon', evening: 'Evening', night: 'Night' }

// The garden's sounds ask the farm's clock whether it is night (no birds then, a few crickets instead): told here
// once, as the interface loads, so the sounds (src/audio/sound.ts) need not load the farm.
hearNight(() => dayNow().phase === 'night')

/** The hour as a clock shows it, to the farm's ten minutes: 8.0 → "08:00", 17.55 → "17:30". */
function clock(hour: number): string {
  const tens = Math.floor(hour * 6 + 1e-6) % 144 // (a hair over: a clock set to 12 reads 12:00, never 11:50)
  const h = Math.floor(tens / 6)
  return `${String(h).padStart(2, '0')}:${(tens % 6) * 10 || '00'}`
}

/** The phase's picture and the hour, on its own one-second timer. */
export function DayChip() {
  const [, setSecond] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSecond((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const { hour, phase } = dayNow()
  const time = clock(hour)
  return (
    <span className="farm-chip-item day" title={`${NAMES[phase]}, ${time}`}>
      <img src={art(phaseDef(phase).art)} alt={NAMES[phase]} />
      <b>{time}</b>
    </span>
  )
}
