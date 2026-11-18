// The game's health, as the simulation can measure it (update-v1 mission 08, change 11; decision 20: no counts leave a
// player's device, so the game is measured here instead): whether a player's visits keep bringing something and keep
// something waiting for the next. It watches the one session runner (./sessions.ts) play a profile's first days at a
// real player's pace, and tells:
// - the visits and days to levels 5, 10 and 20, and to the house (its price in coins, or bought);
// - the rewards a visit brings: a level, what it opens, a garment, a gift box, a goal, the daily gift;
// - the longest stretch of play with none of them, at levels 10 to 19, 20 to 49, and from 50;
// - what waits on a return, by the kind of return (back within the hour, after a few hours, after a night): how long
//   away, how much of it the farm went on for (AWAY_MOST), the goods ready and their worth, the buyers at the gate;
// - the share of visits that end with everything busy: every bed growing, every machine open working
//   (update-v1/research/psychology.md §1.5: open loops that bring a player back to finish them).
// `npm run sim` prints it (./run.sim.ts). It only reads the farm; nothing in the game imports it.

import { ESTATE, MACHINE_IDS, BEDS } from '../farm/data'
import { garmentAt } from '../farm/outfit'
import { bedStage, farm, machineLock, machineStage, type AwayReport } from '../farm/state'
import { opensAt } from '../farm/unlocks'
import { worthOf } from '../farm/worth'
import { levelOf } from '../farm/xp'
import { playVisits, type PaceId, type ProfileId, type Visit, type Weekday } from './sessions'

/** The levels whose visits and days are told, and from which the longest stretch without a reward is. */
export const HEALTH_LEVELS = [5, 10, 20] as const
export const DRY_FROM = [10, 20, 50] as const

/** The rewards a visit can bring, in the order told. */
export const REWARDS = ['level', 'unlock', 'garment', 'gift box', 'goal', 'daily gift'] as const
export type Reward = (typeof REWARDS)[number]

/** When something was first reached: the visit (counted from 1) and the day of play it was in, and the minutes played
 *  by then. Null: not in the days played. */
export interface Reached {
  what: string
  visit: number | null
  day: number | null
  minutes: number | null
}

/** What came while away, on one kind of return. */
export interface Return {
  label: string
  /** how many such returns */
  n: number
  /** the mean time away and the mean time the farm went on for (seconds) */
  away: number
  counted: number
  /** the mean goods ready, their worth in coins at their fair price (src/farm/worth.ts) with the coins in the till, and
   *  the buyers at the gate */
  goods: number
  worth: number
  buyers: number
}

export interface Health {
  profile: ProfileId
  pace: PaceId
  seed: number
  days: number
  weekday: Weekday
  events: boolean
  visits: number
  /** the minutes played in all */
  minutes: number
  level: number
  reached: Reached[]
  /** each reward: how many in all, and the share of visits with at least one */
  rewards: { kind: Reward; total: number; visits: number }[]
  /** the longest stretch of play (minutes) with no reward, among the stretches that begin while the farm is from each of
   *  DRY_FROM's levels to the next (null: the level was not reached), and where it began */
  dry: { from: number; minutes: number | null; at: string | null }[]
  returns: Return[]
  /** the visits that end with every built bed growing and every open machine working, and those that end with something
   *  growing or working at all */
  busy: { n: number; some: number; of: number }
}

/** A look at the farm's rewards so far: the level, gift boxes opened, goals reached, the last daily gift. */
interface Look {
  level: number
  boxes: number
  goals: number
  daily: string | number | null
}
const look = (): Look => ({
  level: levelOf(farm.xp.points),
  boxes: farm.gifts.open + farm.gifts.also.length,
  goals: Object.values(farm.goals).reduce((s: number, n) => s + (n ?? 0), 0),
  daily: farm.daily.last,
})

/** The rewards between two looks, each with how many. */
function rewardsBetween(a: Look, b: Look): [Reward, number][] {
  const out: [Reward, number][] = []
  if (b.level > a.level) out.push(['level', b.level - a.level])
  let opened = 0
  let garments = 0
  for (let l = a.level + 1; l <= b.level; l++) {
    opened += opensAt(l).length
    if (garmentAt(l)) garments++
  }
  if (opened) out.push(['unlock', opened])
  if (garments) out.push(['garment', garments])
  if (b.boxes > a.boxes) out.push(['gift box', b.boxes - a.boxes])
  if (b.goals > a.goals) out.push(['goal', b.goals - a.goals])
  if (b.daily !== a.daily) out.push(['daily gift', 1])
  return out
}

/** Every built bed growing and every open machine working. */
export function allBusy(): boolean {
  for (let i = 0; i < BEDS.length; i++) {
    const s = bedStage(i)
    if (s !== 'unbought' && s !== 'locked' && s !== 'growing') return false
  }
  return MACHINE_IDS.every((id) => machineLock(id) !== null || machineStage(id) === 'working')
}

/** Something growing or working at all. */
export const someBusy = () => BEDS.some((_, i) => bedStage(i) === 'growing') || MACHINE_IDS.some((id) => machineStage(id) === 'working')

/** What a return found waiting, in coins: the goods ready at their fair price, and the till's coins. */
export const returnWorth = (back: AwayReport) => worthOf(back.goods.map((g) => ({ item: g.item, n: g.count }))) + (back.shop?.coins ?? 0)

/** Plays a profile's first `days` days (./sessions.ts: from a Monday and without the week's events, unless told) and
 *  measures them. */
export function health(opts: { profile: ProfileId; days: number; pace?: PaceId; seed?: number; weekday?: Weekday; events?: boolean }): Health {
  const pace = opts.pace ?? 'real'
  const seed = opts.seed ?? 1
  const weekday = opts.weekday ?? 1
  const events = opts.events ?? false
  const reached = new Map<string, Reached>()
  const reach = (what: string, visit: number, day: number, minutes: number) => {
    if (!reached.has(what)) reached.set(what, { what, visit, day, minutes })
  }
  const totals = new Map<Reward, number>()
  const withReward = new Map<Reward, number>()
  /** each reward's minute of play and the level then, in order */
  const times: { minute: number; level: number }[] = []
  const returns = new Map<string, { n: number; away: number; counted: number; goods: number; worth: number; buyers: number }>()
  let visits = 0
  let busy = 0
  let some = 0
  let played = 0
  let last: Look = look()
  let thisVisit = new Set<Reward>()
  let current: Visit | null = null

  const check = (at: number) => {
    const now = look()
    const minute = played + at / 60
    for (const [kind, n] of rewardsBetween(last, now)) {
      totals.set(kind, (totals.get(kind) ?? 0) + n)
      thisVisit.add(kind)
      times.push({ minute, level: last.level })
    }
    last = now
    for (const l of [...HEALTH_LEVELS, ...DRY_FROM]) if (now.level >= l) reach(`level ${l}`, visits, current!.day, minute)
    if (farm.apartment.owned || farm.coins >= ESTATE.price) reach('the house', visits, current!.day, minute)
  }

  playVisits(
    { profile: opts.profile, days: opts.days, pace, seed, weekday, events },
    {
      begin(visit, back) {
        visits++
        current = visit
        thisVisit = new Set()
        last = look()
        if (back) {
          const r = returns.get(visit.label) ?? { n: 0, away: 0, counted: 0, goods: 0, worth: 0, buyers: 0 }
          r.n++
          r.away += back.seconds
          r.counted += back.counted
          r.goods += back.goods.reduce((s, g) => s + g.count, 0)
          r.worth += returnWorth(back)
          r.buyers += back.buyers
          returns.set(visit.label, r)
        }
      },
      moved: (_visit, _move, at) => check(at),
      end(_visit, seconds) {
        check(seconds)
        played += seconds / 60
        for (const kind of thisVisit) withReward.set(kind, (withReward.get(kind) ?? 0) + 1)
        if (allBusy()) busy++
        if (someBusy()) some++
      },
    },
  )

  const level = last.level
  // the longest stretch with no reward among those that begin while the farm is from one of DRY_FROM's levels to the next
  // (a level reached is a reward), to the next reward or the end of play
  const dry = DRY_FROM.map((from, i) => {
    const start = reached.get(`level ${from}`)?.minutes
    if (start === undefined || start === null) return { from, minutes: null, at: null }
    const until = reached.get(`level ${DRY_FROM[i + 1]}`)?.minutes ?? played
    const marks = [start, ...times.filter((t) => t.minute > start).map((t) => t.minute), played]
    let best = 0
    let at = start
    for (let j = 1; j < marks.length && marks[j - 1] < until; j++)
      if (marks[j] - marks[j - 1] > best) {
        best = marks[j] - marks[j - 1]
        at = marks[j - 1]
      }
    return { from, minutes: best, at: `${Math.round(at)} min played` }
  })

  return {
    profile: opts.profile,
    pace,
    seed,
    days: opts.days,
    weekday,
    events,
    visits,
    minutes: played,
    level,
    reached: [...HEALTH_LEVELS.map((l) => `level ${l}`), 'the house'].map((what) => reached.get(what) ?? { what, visit: null, day: null, minutes: null }),
    rewards: REWARDS.map((kind) => ({ kind, total: totals.get(kind) ?? 0, visits: (withReward.get(kind) ?? 0) / Math.max(1, visits) })),
    dry,
    returns: [...returns].map(([label, r]) => ({ label, n: r.n, away: r.away / r.n, counted: r.counted / r.n, goods: r.goods / r.n, worth: r.worth / r.n, buyers: r.buyers / r.n })),
    busy: { n: busy, some, of: visits },
  }
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const hours = (s: number) => (s >= 3600 ? `${(s / 3600).toFixed(1)} h` : `${Math.round(s / 60)} min`)
const pct = (x: number) => `${Math.round(x * 100)} %`

/** The health table, as plain text (`npm run sim`). */
export function healthReport(h: Health): string {
  const out: string[] = []
  out.push(
    `Health: the ${h.profile} player's first ${h.days} days at a ${h.pace} pace, from a ${WEEKDAYS[h.weekday - 1]}${h.events ? ' with the week’s events' : ''} (seed ${h.seed}): ${h.visits} visits, ${Math.round(h.minutes)} minutes played, level ${h.level}`,
    '',
    'Reached           visit    day   minutes played',
  )
  for (const r of h.reached)
    out.push(
      `  ${r.what.padEnd(15)} ${(r.visit === null ? '—' : String(r.visit)).padStart(5)}  ${(r.day === null ? '—' : String(r.day)).padStart(5)}  ${r.minutes === null ? `not in ${h.days} days` : String(Math.round(r.minutes)).padStart(6)}`,
    )
  out.push('', 'Rewards           in all  a visit  visits with one')
  for (const r of h.rewards) out.push(`  ${r.kind.padEnd(15)} ${String(r.total).padStart(6)}  ${(r.total / Math.max(1, h.visits)).toFixed(2).padStart(7)}  ${pct(r.visits).padStart(15)}`)
  out.push('', 'The longest stretch of play with no reward')
  h.dry.forEach((d, i) => {
    const band = i + 1 < h.dry.length ? `levels ${d.from}–${h.dry[i + 1].from - 1}` : `from level ${d.from}`
    out.push(`  ${band.padEnd(15)} ${d.minutes === null ? `level ${d.from} not reached in ${h.days} days` : `${Math.round(d.minutes)} min (from ${d.at})`}`)
  })
  out.push('', 'What waits on a return (means)', '  return                 n     away  counted   goods  worth (coins)  buyers')
  for (const r of h.returns)
    out.push(
      `  ${r.label.padEnd(20)} ${String(r.n).padStart(3)}  ${hours(r.away).padStart(7)}  ${pct(r.counted / Math.max(1, r.away)).padStart(7)}  ${r.goods.toFixed(1).padStart(6)}  ${String(Math.round(r.worth)).padStart(13)}  ${r.buyers.toFixed(1).padStart(6)}`,
    )
  const of = Math.max(1, h.busy.of)
  out.push(
    '',
    `Visits that end with everything busy (every bed growing, every open machine working): ${h.busy.n} of ${h.busy.of} (${pct(h.busy.n / of)})`,
    `Visits that end with something growing or working: ${h.busy.some} of ${h.busy.of} (${pct(h.busy.some / of)})`,
  )
  return out.join('\n')
}
