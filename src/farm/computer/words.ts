import { clock, span } from '../../lib/time'
import { dayStart } from '../calendar'
import type { Channel } from '../ledger'

// How the computer writes its numbers (the desktop and its apps): coins a unit to a tenth where they are small, a move
// as an arrow and a percent, a wait in the game's own clock (src/lib/time.ts), a day by its weekday. Every number has
// its words beside it (no chart is read by its picture alone). Pure but for the device's locale.

/** Where a good is sold, in a few words: its name in a list, and its name in a line ("Pays most at the orders"). */
export const CHANNEL_WORDS: Record<Channel, { name: string; at: string }> = {
  gate: { name: 'Buyers at the gate', at: 'at the gate' },
  order: { name: 'Orders', at: 'in an order' },
  manager: { name: 'The manager', at: 'to the manager' },
  shop: { name: 'Your shop', at: 'in your shop' },
  contractor: { name: 'The contractor', at: 'to the contractor' },
}

const tenth = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const whole = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })
const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 })

/** Coins: to a tenth under 100 (a unit's price: 3.2), whole from 100 (1,240). */
export const coinsText = (n: number) => (Math.abs(n) < 100 ? tenth : whole).format(n)

/** Within this many percent a price holds: no arrow. */
export const STILL_PCT = 0.5

/** A move in percent (8: 8 % up) as an arrow and its size: ▲ 8 %, ▼ 4 %, or "Same" (within half a percent); which
 *  way, and the chip it stands on (the game's: `ok` up, `short` down). */
export function moveText(pct: number): { text: string; tone: 'up' | 'down' | 'flat'; chip: 'ok' | 'short' | 'still'; words: string } {
  if (!Number.isFinite(pct) || Math.abs(pct) < STILL_PCT) return { text: 'Same', tone: 'flat', chip: 'still', words: 'the same' }
  const size = percent.format(Math.abs(pct) / 100)
  return pct > 0 ? { text: `▲ ${size}`, tone: 'up', chip: 'ok', words: `up ${size}` } : { text: `▼ ${size}`, tone: 'down', chip: 'short', words: `down ${size}` }
}

/** What a factor does to a price, as a percent (1.2: +20 %; 0.96: −4 %). */
export const timesText = (times: number) => {
  const p = Math.round((times - 1) * 100)
  return `${p >= 0 ? '+' : '−'}${Math.abs(p)} %`
}

/** How long until something sells: at once, a countdown under an hour, words from an hour; null: nobody asks yet. */
export const waitText = (seconds: number | null) => (seconds === null ? 'Nobody asks yet' : seconds <= 0 ? 'At once' : seconds < 3600 ? `In about ${clock(seconds)}` : `In about ${span(seconds)}`)

/** A chance as "1 in n" (0: none). */
export const oddsText = (p: number) => (p <= 0 ? 'No gift' : p >= 1 ? 'A gift every time' : `1 in ${Math.round(1 / p)} a gift`)

const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
/** A calendar day (src/farm/calendar.ts) by its weekday's short name, on the device's calendar. */
export const weekday = (day: number) => weekdayFormat.format(new Date(dayStart(day)))

/** How long a bed or a job takes, as the game writes a length. */
export const lengthText = (seconds: number) => span(seconds)
