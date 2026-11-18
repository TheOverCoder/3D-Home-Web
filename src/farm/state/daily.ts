import { useHome } from '../../store'
import { levelOf } from '../xp'
import type { Prize } from '../gifts'
import { claimed, dailyStatus, dailyView, dayNumber, rollDay, type DailyView } from '../daily'
import { bump, calendarDay, calendarTime, farm, random, save } from './core'
import { give, rewarded } from './rewards'
import { stepsBusy } from './steps'

// The daily gift (src/farm/daily.ts): whether it waits, when it opens by itself, and claiming it.

/** Put out of the way (the tests that do not test it: src/farm/daily.ts never opens by itself, nor shows on the menu).
 *  The card open is closed. Not kept: a page loaded again has it as always. */
let dailyQuiet = false
export function quietDaily(on: boolean) {
  dailyQuiet = on
  if (on && useHome.getState().panel?.kind === 'daily') useHome.getState().closePanel()
  bump()
}

/** The daily gift's card as it stands today (./DailyCard.tsx), with how long until the next one opens. */
export function dailyNow(): DailyView {
  const now = calendarTime()
  return dailyView(farm.daily, dayNumber(now), levelOf(farm.xp.points), now)
}

/** Today's gift waits for the player: it can be claimed, on a farm that has begun (one that has planted: a new farm's
 *  first minutes are for learning to play) and is through its first steps, and it is not put out of the way. The menu
 *  in the corner shows it then. */
export const dailyWaiting = () => !dailyQuiet && farm.started && !stepsBusy() && dailyStatus(farm.daily, calendarDay()).ready

/** Today's gift opens by itself: it waits, and it has not opened by itself today (it does once a day, then only from
 *  the menu). */
export const dailyDue = () => dailyWaiting() && farm.daily.offered !== calendarDay()

/** The card opened by itself today: not again today. */
export function offerDaily() {
  const day = calendarDay()
  if (farm.daily.offered === day) return
  farm.daily = { ...farm.daily, offered: day }
  bump()
  save()
}

/**
 * Claims today's gift: rolled on the farm's dice (src/farm/daily.ts, rollDay) for the week's day it is, at the farm's
 * level, and given at once — coins, or goods into their building even past full (as surprises go); the streak goes on
 * (a missed day forgiven) or a new week starts. What it gave, or null when there is none today (taken already, or the
 * clock before the last day claimed): never twice. No XP: a gift is not something done.
 */
export function claimDaily(): Prize[] | null {
  const day = calendarDay()
  const s = dailyStatus(farm.daily, day)
  if (!s.ready) return null
  const prizes = rollDay(s.day, levelOf(farm.xp.points), farm.made, random)
  const next = claimed(farm.daily, day, prizes)
  if (!next) return null
  for (const p of prizes) give(p)
  rewarded('daily', prizes)
  farm.daily = next
  // (its sound and its touch come as it bursts open on its card)
  bump()
  save()
  return prizes
}
