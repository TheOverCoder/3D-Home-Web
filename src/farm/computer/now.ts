import { dayNumber } from '../calendar'
import { moodToday } from '../mood'
import { calendarDay, calendarTime, eventTime, farm, lockOf } from '../state'
import { UNLOCK_IDS, unlockLevel } from '../unlocks'
import { levelOf } from '../xp'
import type { MarketNow } from './marketView'

// The moment the house's computer works its views out at (./marketView.ts, ./planView.ts): the farm's own, so that
// every price it shows is the one a sale would take now.

/** The day the market's mood is judged on now, as every sale's price judges it (src/farm/state/day.ts): the events'
 *  day (a time away's step on its own), or with the events off the calendar's. */
export const moodDayNow = () => dayNumber(eventTime() ?? calendarTime())

/** The events' moment, today on the device's calendar, the market's mood as every sale has it now (judged on its own
 *  day: the views ask it of the day they call today), and whether everything is open whatever the level (a ?debug
 *  page). */
export function computerNow(): MarketNow {
  const day = calendarDay()
  const shift = moodDayNow() - day
  const level = levelOf(farm.xp.points)
  return {
    at: eventTime(),
    day,
    mood: (good, d) => moodToday(good, d + shift),
    allOpen: UNLOCK_IDS.some((id) => unlockLevel(id) > level && lockOf(id) === null),
  }
}
