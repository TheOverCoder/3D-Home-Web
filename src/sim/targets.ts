// The pace a new farm is held to (src/sim/pace.test.ts, played by src/sim/play.ts; `npm run sim` prints it).
//
// What a well-paced casual farm game does in its first hours: a first reward within the first few minutes, a level
// every few minutes through the first session, then each level a little longer, so that the first hour brings about
// ten and the second a few more. A first session lasts about nine minutes on average, and games whose first session
// runs longer keep more players the next day (31 % against 20 %: deltaDNA's study of over 5,000 games, "How first
// session length impacts game performance", Game Developer); the first ten minutes decide whether a player comes back
// (Google Play, "Why the first ten minutes are crucial if you want to keep players coming back to your mobile game").
// Hay Day's levels have the same shape: a few XP each to the first ones, about a thousand to level 10. The bands are
// for the simulation's player, who never dawdles: a real one gets there later.

export const PACE = {
  /** the minutes of play by which each level is reached: [no sooner than, no later than] */
  levels: {
    2: [0, 3],
    3: [1, 6],
    4: [3, 10],
    5: [5, 15],
    6: [8, 20],
    7: [11, 26],
    8: [14, 32],
    9: [18, 40],
    10: [22, 48],
    11: [27, 57],
    12: [32, 67],
    13: [38, 78],
    14: [44, 90],
    15: [50, 105],
    // from 16 (update-v1/missions/01-loop-economy.md): from 0.6 times the soonest to 1.2 times the latest of seeds 1–3
    // as the farm stood before the update's rows, so the new rows (01's waves, the neighbours' recipes) keep its pace
    16: [40, 86],
    17: [46, 95],
    18: [50, 104],
    19: [55, 116],
    20: [62, 125],
    21: [68, 139],
    22: [74, 149],
    23: [79, 161],
    24: [86, 175],
    25: [92, 190],
    26: [100, 203],
    27: [107, 218],
    28: [115, 236],
    29: [121, 248],
    30: [130, 264],
  } as Record<number, readonly [number, number]>,
  /** in the first `within` minutes, no stretch with nothing useful to do longer than `most` minutes */
  idle: { within: 60, most: 5 },
  /** each animal's tool (plans/animal-tools.md) is bought within `within` minutes of play after its herd is full */
  tools: { within: 20 },
  // The rest are held on the session runner (./sessions.ts, ./journey.ts: the daily player at a real player's pace,
  // who leaves at the end of each visit as ./policy.ts LEAVING has it): a session ends by setting something long, a
  // night pays, and play pays more as the levels go up (update-v1/missions/01-loop-economy.md, the PACE additions).
  /** the first sitting ends with something on its way at least `seconds` long (a session ends by setting the next
   *  appointment) */
  first: { seconds: 3600 },
  /** a night's return, on the mornings of `days`: worth `minutes` of play's income at its level (src/farm/economy.ts,
   *  incomeAt; decision 3: about 30); and as the evening before ended, what was on its way through the night at least
   *  `break.times` what a break of `break.seconds` would bring */
  night: { days: [2, 7, 14], minutes: [20, 40], break: { seconds: 30 * 60, times: 2 } },
  /** coins a minute of play (the good player, ./play.ts) over the levels of `high`, at least `times` those over `low`:
   *  play pays more as it goes on */
  income: { low: [13, 15], high: [28, 30], times: 1.4 },
  /** of the rewards paid in the first `within` minutes of play (src/farm/state/rewards.ts, rewardCounts), the share
   *  that is small, and the share that is big or huge (measured by 05a on seeds 1–3: 71–76 % and 6–7 %) */
  rewards: { within: 60, small: [0.65, 0.85], big: [0.03, 0.12] },
  /** the season road (src/farm/seasonRoad.ts, JOURNEY.md fix 4): a player of `profile` (SESSIONS: ten minutes a day)
   *  reaches its last stop by the season's day `by` (days played), on each of the first `seasons` seasons; held on the
   *  session runner by src/farm/seasonRoad.pace.test.ts */
  road: { profile: 'light', by: 6, seasons: 2 },
} as const

/** One visit of a player's day: the hour it begins (18.9 is 18:54) and how long it lasts. */
export interface VisitRow {
  hour: number
  minutes: number
  label: string
}

/** Who plays, and when (./sessions.ts plays them; update-v1/missions/08-engines-stability.md, change 11). A new farm
 *  begins in the evening: a first sitting long enough to finish the first steps (a first session of about nine minutes
 *  or more keeps more players: the deltaDNA study above), a visit back within the hour, and the first evening. After
 *  it, the daily player comes three times a day (morning 8 minutes, noon 5, evening 12, a night of about ten hours
 *  between), and the light player once, ten minutes in the morning, resting two days a week (`rest`: the days of each
 *  week with no visit, the first day being 1). */
export const SESSIONS = {
  daily: {
    first: [
      { hour: 18, minutes: 15, label: 'first sitting' },
      { hour: 18.9, minutes: 6, label: 'back within the hour' },
      { hour: 21.5, minutes: 10, label: 'first evening' },
    ],
    days: [
      { hour: 7.5, minutes: 8, label: 'morning' },
      { hour: 12.5, minutes: 5, label: 'noon' },
      { hour: 21, minutes: 12, label: 'evening' },
    ],
    rest: [] as number[],
  },
  light: {
    first: [
      { hour: 18, minutes: 15, label: 'first sitting' },
      { hour: 18.9, minutes: 6, label: 'back within the hour' },
      { hour: 21.5, minutes: 10, label: 'first evening' },
    ],
    days: [{ hour: 8, minutes: 10, label: 'morning' }],
    rest: [4, 5],
  },
} as const satisfies Record<string, { first: readonly VisitRow[]; days: readonly VisitRow[]; rest: readonly number[] }>

/**
 * The journey a player's visits are held to (update-v1/JOURNEY.md; measured by ./journey.ts on the session runner,
 * held by ./journey.test.ts, where a bound today's farm breaks is a listed debt naming the mission that pays it). The
 * pull should come from something good waiting, never from pressure (update-v1/research/psychology.md): something new
 * often enough that a visit is worth it, never so much at once that none of it is seen, few cards before the first
 * tap, a farm that works while you are away, and a return that does not start on a full store.
 */
export const JOURNEY = {
  /** in the first `days` days, at most `most` visits in a row with nothing new (a level that opens something, a
   *  garment, a first step) */
  quiet: { days: 7, most: 1 },
  /** from day `from` on, at most `most` days in a row with nothing new */
  quietDays: { from: 8, most: 1 },
  /** no more than `most` things for the eye (new things, prizes, cards) within any `within` seconds of a visit */
  burst: { most: 3, within: 60 },
  /** cards that open by themselves before a visit's first tap (the welcome back counted) */
  auto: { most: 2 },
  /** each visit ends with something on its way through at least `share` of the time away (at most `most` seconds) */
  pull: { share: 0.5, most: 4 * 3600 },
  /** the share of returns from day `from` on, at most, that find the silo or the barn full */
  full: { share: 0.25, from: 2 },
} as const
