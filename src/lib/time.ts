// How the game writes a time (update-v1/CONTRACTS.md §1.1): every countdown, every length of time and every "ready at"
// goes through one of these three, so that no two places round differently and none ever shows "1:60". A countdown
// under an hour is a clock (`clock`); a wait of an hour or more, and a length, are words (`span`); where a time of day
// helps, the device's own clock (`readyAt`), never the farm's hours. Pure, no imports; not yet used by the game (08's
// first commit moves today's formatters onto it).

/** Whole seconds left, rounded up: a part of a second still counts (it is not over); nothing, or not a number: 0. */
const left = (seconds: number) => (Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds - 1e-9) : 0)
const two = (n: number) => String(n).padStart(2, '0')

/** A countdown as a clock shows it: m:ss under an hour, h:mm:ss from an hour; rounded up, so never 0:00 while time is
 *  left. 59.5 → '1:00', 3725 → '1:02:05'; NaN, negative or 0 → '0:00'. */
export function clock(seconds: number): string {
  const s = left(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`
}

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

/** A length of time in words, rounded up to the unit shown: '45 s', '6 min', '2 h 14 min', '2 h', '1 day 4 h',
 *  '3 days'. Nothing, or not a number: '0 s'. */
export function span(seconds: number): string {
  const s = left(seconds)
  if (s < 60) return `${s} s`
  const minutes = Math.ceil(s / 60)
  if (minutes < 60) return `${minutes} min`
  if (minutes < 24 * 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m ? `${h} h ${m} min` : `${h} h`
  }
  const hours = Math.ceil(s / 3600)
  if (hours < 72) {
    const d = Math.floor(hours / 24)
    const h = hours % 24
    return h ? `${days(d)} ${h} h` : days(d)
  }
  return days(Math.ceil(s / 86_400))
}

/** Whether two moments fall on the same date of the device's calendar. */
const sameDate = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** When something `seconds` from `now` will be ready, on the device's own clock (12 or 24 h as the device, or `locale`,
 *  writes it): '21:40', 'tomorrow 07:10', and past tomorrow its weekday, 'Fri 07:10'. Never the farm's hours. */
export function readyAt(seconds: number, now: number = Date.now(), locale?: string): string {
  const at = new Date(now + left(seconds) * 1000)
  const from = new Date(now)
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(at)
  if (sameDate(at, from)) return time
  if (sameDate(at, new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1))) return `tomorrow ${time}`
  return `${new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(at)} ${time}`
}
