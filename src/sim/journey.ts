// The journey (update-v1/JOURNEY.md): what each visit of a player's first days brings that is new, what pulls them back,
// and the bounds a healthy journey keeps (JOURNEY in ./targets.ts, held by ./journey.test.ts). It watches the one
// session runner (./sessions.ts) and reads the farm through SOURCES, one row a system: what is new between two looks at
// the farm, and what it has on the way as a visit ends. A system a mission adds (the album, the season's road, letters,
// chapters, the seasons) joins as a row here, in that mission's commit, and a card that opens by itself as a row of
// AUTO_CARDS. It only reads the farm; nothing in the game imports it.

import { worthWithin } from '../farm/appointments'
import { CROPS, MACHINE_IDS, type StoreId } from '../farm/data'
import { returnWorth } from '../farm/economy'
import { tilesEarned } from '../farm/album'
import { garmentAt } from '../farm/outfit'
import { AWAY_TELLS, awayNews, bedStage, dailyDue, farm, machineSecondsLeft, machineStage, stepNow, type AwayReport } from '../farm/state'
import { opensAt, unlockName } from '../farm/unlocks'
import { nextCard, type CardId } from '../ui/cardQueue'
import { levelOf } from '../farm/xp'
import { planLeave } from './policy'
import { playVisits, visitStart, visitsOf, type PaceId, type ProfileId, type Visit } from './sessions'
import { JOURNEY, PACE } from './targets'

/** What a visit brings: something not seen before (a level that opens something, a garment, a first step), a prize
 *  (a gift, a goal, a level's coins), or a card that only tells (the welcome back). */
export type BeatKind = 'new' | 'prize' | 'card'

export interface Beat {
  source: string
  kind: BeatKind
  what: string
  /** seconds into the visit */
  at: number
}

/** Something on its way as a visit ends, and the seconds until it. */
export interface Pull {
  source: string
  what: string
  seconds: number
}

/** One system of the farm as the journey sees it: a look at what it holds now, what is new between two looks, and
 *  what it has on its way. */
export interface Source<T> {
  id: string
  look: () => T
  news: (before: T, after: T) => { kind: BeatKind; what: string }[]
  pull?: (now: T) => { what: string; seconds: number } | null
}
const source = <T>(s: Source<T>) => s as unknown as Source<unknown>

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** What is still growing or working, the longest first: the farm's work through the time away. */
function longest(): { what: string; seconds: number } | null {
  let best: { what: string; seconds: number } | null = null
  farm.beds.forEach((b, i) => {
    if (!b.crop || bedStage(i) === 'ripe') return
    const crop = CROPS.find((c) => c.id === b.crop)!
    const left = crop.growSeconds - b.growth
    // without sprinklers a bed stops when its water runs out
    const seconds = farm.sprinkler ? left : Math.min(left, b.water)
    if (!best || seconds > best.seconds) best = { what: `${crop.id} ripe`, seconds }
  })
  for (const id of MACHINE_IDS) {
    if (machineStage(id) !== 'working') continue
    const seconds = machineSecondsLeft(id)
    if (!best || seconds > best.seconds) best = { what: `the ${id} done`, seconds }
  }
  return best
}

/** Today's systems. */
export const SOURCES: Source<unknown>[] = [
  source({
    id: 'first steps',
    look: () => stepNow()?.id ?? null,
    news: (a, b) => (a === b ? [] : [{ kind: 'new', what: b === null ? 'the first steps done' : `step: ${b}` }]),
  }),
  source({
    id: 'levels',
    look: () => levelOf(farm.xp.points),
    news: (a, b) => {
      const out: { kind: BeatKind; what: string }[] = []
      for (let level = a + 1; level <= b; level++) {
        const opens = opensAt(level).map(unlockName)
        const garment = garmentAt(level)
        const all = [...opens, ...(garment ? [garment.name] : [])]
        out.push(all.length ? { kind: 'new', what: `level ${level}: ${all.join(', ')}` } : { kind: 'prize', what: `level ${level}` })
      }
      return out
    },
  }),
  source({
    id: 'gift boxes',
    look: () => farm.gifts.open + farm.gifts.also.length,
    news: (a, b) => (b > a ? [{ kind: 'prize', what: plural(b - a, 'gift box', 'gift boxes') }] : []),
  }),
  source({
    id: 'goals',
    look: () => Object.values(farm.goals).reduce((s: number, n) => s + (n ?? 0), 0),
    news: (a, b) => (b > a ? [{ kind: 'prize', what: plural(b - a, 'goal') }] : []),
  }),
  source({
    id: 'daily gift',
    look: () => farm.daily.last,
    news: (a, b) => (a === b ? [] : [{ kind: 'prize', what: 'the daily gift' }]),
  }),
  // what the farm's year and its people bring: a letter in the mailbox (a chapter, a heart, a birthday), a stop of the
  // season road reached, an album tile earned — each something new to see, as JOURNEY counts them
  source({
    id: 'letters',
    look: () => farm.mail.waiting.length + farm.mail.read.length,
    news: (a, b) => (b > a ? [{ kind: 'new', what: plural(b - a, 'letter') }] : []),
  }),
  source({
    id: 'season road',
    look: () => farm.seasonRoad.on * 100 + farm.seasonRoad.paid,
    news: (a, b) => (b > a ? [{ kind: 'new', what: 'a stop of the season road' }] : []),
  }),
  source({
    id: 'album',
    look: () => tilesEarned(farm).length,
    news: (a, b) => (b > a ? [{ kind: 'new', what: plural(b - a, 'album tile') }] : []),
  }),
  source({ id: 'work', look: longest, news: () => [], pull: (now) => now }),
]

/** The cards that open by themselves as a visit begins (`card`: its id in the game's queue, src/ui/cardQueue.ts), and
 *  the ones that open: as the queue opens them, in its order and within its budget. */
export const AUTO_CARDS: { id: string; card: CardId; opens: (back: AwayReport | null) => boolean }[] = [
  { id: 'welcome back', card: 'away', opens: (back) => back !== null && back.seconds >= AWAY_TELLS && awayNews(back) },
  { id: 'daily gift', card: 'daily', opens: () => dailyDue() },
]
function autoCards(back: AwayReport | null): string[] {
  const due = AUTO_CARDS.filter((c) => c.opens(back)).map((c) => c.card)
  const opened: CardId[] = []
  for (;;) {
    const id = nextCard({ due, opened, free: true, showing: null, stepsEndedThisVisit: false })
    if (!id) return opened.map((card) => AUTO_CARDS.find((c) => c.card === card)!.id)
    opened.push(id)
  }
}

export interface VisitNews extends Visit {
  /** minutes played before it */
  minute: number
  /** seconds it lasted */
  seconds: number
  level: [from: number, to: number]
  /** what came while away (null on the first visit): `worth`, what its goods are worth net (src/farm/economy.ts,
   *  returnWorth) */
  back: { away: number; counted: number; goods: number; worth: number; buyers: number; full: StoreId[] } | null
  /** the cards that opened by themselves before its first move */
  auto: string[]
  beats: Beat[]
  /** the longest thing on its way as it ended (null: nothing) */
  pull: Pull | null
  /** seconds until the next visit (null: the last) */
  gap: number | null
  /** as it ended: what the farm had on its way, in coins (net), ready within the time until the next visit (a night
   *  after the last) and within a short break (PACE.night.break) */
  left: { within: number; brk: number }
}

/** The time away after a profile's last visit: a night. */
const NIGHT = 10 * 3600

/** Plays a profile's first `days` days (./sessions.ts) and tells, visit by visit, what each brought and left on its way. */
export function journey(opts: { profile: ProfileId; days: number; pace?: PaceId; seed?: number }): VisitNews[] {
  const out: VisitNews[] = []
  let looks: unknown[] = []
  let now: VisitNews | null = null
  let minute = 0
  // the schedule, so the player knows when each visit ends and how long until the next (./policy.ts, LEAVING)
  const visits = visitsOf(opts.profile, opts.days)
  const gapAfter = (k: number) => (k + 1 < visits.length ? (visitStart(visits[k + 1]) - visitStart(visits[k])) / 1000 - visits[k].minutes * 60 : NIGHT)
  const diff = (at: number) => {
    const next = SOURCES.map((s) => s.look())
    SOURCES.forEach((s, i) => {
      for (const n of s.news(looks[i], next[i])) now!.beats.push({ source: s.id, ...n, at })
    })
    looks = next
  }
  try {
    playVisits(opts, {
      begin(visit, back) {
        if (out.length) out[out.length - 1].gap = back?.seconds ?? null
        planLeave({ at: visitStart(visit) + visit.minutes * 60_000, gap: gapAfter(out.length) })
        const auto = autoCards(back)
        now = {
          ...visit,
          minute,
          seconds: 0,
          level: [levelOf(farm.xp.points), 0],
          back: back && {
            away: back.seconds,
            counted: back.counted,
            goods: back.goods.reduce((s, g) => s + g.count, 0),
            worth: returnWorth(back.goods),
            buyers: back.buyers,
            full: [...back.full],
          },
          auto,
          beats: auto.includes('welcome back') ? [{ source: 'welcome back', kind: 'card', what: 'welcome back', at: 0 }] : [],
          pull: null,
          gap: null,
          left: { within: 0, brk: 0 },
        }
        looks = SOURCES.map((s) => s.look())
      },
      moved: (_visit, _move, at) => diff(at),
      end(_visit, played) {
        diff(played)
        const v = now!
        v.seconds = played
        v.level[1] = levelOf(farm.xp.points)
        for (const s of SOURCES) {
          const p = s.pull?.(s.look())
          if (p && (!v.pull || p.seconds > v.pull.seconds)) v.pull = { source: s.id, ...p }
        }
        v.left = { within: worthWithin(farm, gapAfter(out.length)), brk: worthWithin(farm, PACE.night.break.seconds) }
        minute += played / 60
        out.push(v)
      },
    })
  } finally {
    planLeave(null)
  }
  return out
}

export type Bound = keyof typeof JOURNEY

const name = (v: VisitNews) => `day ${v.day} ${v.label}`
const clock = (s: number) => (s >= 3600 ? `${(s / 3600).toFixed(1)} h` : `${Math.round(s / 60)} min`)
const isNew = (v: VisitNews) => v.beats.some((b) => b.kind === 'new')

/**
 * Each bound of JOURNEY that a journey breaks, in words (an empty list: kept). A bound the journey cannot judge (its
 * days were not played) gives null, never an empty list.
 */
export function holes(news: VisitNews[], bounds = JOURNEY): Record<Bound, string[] | null> {
  const quiet = (() => {
    const first = news.filter((v) => v.day <= bounds.quiet.days)
    if (!first.length) return null
    const out: string[] = []
    let run: VisitNews[] = []
    for (const v of [...first, null]) {
      if (v && !isNew(v)) {
        run.push(v)
        continue
      }
      if (run.length > bounds.quiet.most) out.push(`${run.length} visits with nothing new: ${name(run[0])} to ${name(run[run.length - 1])}`)
      run = []
    }
    return out
  })()
  const quietDays = (() => {
    const days = [...new Set(news.filter((v) => v.day >= bounds.quietDays.from).map((v) => v.day))]
    if (!days.length) return null
    const out: string[] = []
    let run: number[] = []
    for (const day of [...days, null]) {
      if (day !== null && !news.some((v) => v.day === day && isNew(v))) {
        run.push(day)
        continue
      }
      if (run.length > bounds.quietDays.most) out.push(`${run.length} days of play with nothing new: days ${run[0]} to ${run[run.length - 1]}`)
      run = []
    }
    return out
  })()
  const burst = news.flatMap((v) => {
    let worst: Beat[] = []
    for (const b of v.beats) {
      const near = v.beats.filter((c) => c.at >= b.at && c.at < b.at + bounds.burst.within)
      if (near.length > worst.length) worst = near
    }
    return worst.length > bounds.burst.most ? [`${name(v)}: ${worst.length} things within ${bounds.burst.within} s (${worst.map((b) => b.what).join('; ')})`] : []
  })
  const auto = news.filter((v) => v.auto.length > bounds.auto.most).map((v) => `${name(v)}: ${v.auto.join(', ')}`)
  const pull = news.flatMap((v) => {
    if (v.gap === null) return []
    const need = Math.min(v.gap * bounds.pull.share, bounds.pull.most)
    const has = v.pull?.seconds ?? 0
    return has >= need ? [] : [`${name(v)}: ${v.pull ? `${v.pull.what} in ${clock(has)}` : 'nothing on its way'}, for ${clock(v.gap)} away`]
  })
  const full = (() => {
    const returns = news.filter((v) => v.back && v.day >= bounds.full.from)
    if (!returns.length) return null
    const n = returns.filter((v) => v.back!.full.length > 0).length
    return n / returns.length > bounds.full.share ? [`${n} of ${returns.length} returns (${Math.round((100 * n) / returns.length)} %) found a store full`] : []
  })()
  return { quiet, quietDays, burst, auto, pull, full }
}

/** A journey as plain text: one line a visit, then the bounds it breaks (`npm run sim` with SIM_JOURNEY). */
export function journeyReport(news: VisitNews[], bounds = JOURNEY): string {
  const hhmm = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`
  const out: string[] = []
  for (const v of news) {
    const back = v.back ? `back after ${clock(v.back.away)}: ${v.back.goods} goods, ${v.back.buyers} buyers${v.back.full.length ? `, ${v.back.full.join(' and ')} full` : ''}` : 'a new farm'
    const fresh = v.beats.filter((b) => b.kind === 'new').map((b) => b.what)
    const prizes = v.beats.filter((b) => b.kind === 'prize').length
    out.push(
      `day ${String(v.day).padStart(2)} ${hhmm(v.hour)} ${v.label.padEnd(20)} ${String(Math.round(v.minute)).padStart(4)} min played  level ${v.level[0]}→${v.level[1]}  ${back}`,
      `        cards by themselves: ${v.auto.join(', ') || 'none'} · new: ${fresh.join(' · ') || 'nothing'} · prizes: ${prizes} · on its way: ${v.pull ? `${v.pull.what} in ${clock(v.pull.seconds)}` : 'nothing'}`,
    )
  }
  out.push('', 'The journey’s bounds (JOURNEY):')
  for (const [bound, broken] of Object.entries(holes(news, bounds))) {
    out.push(`  ${bound}: ${broken === null ? 'not judged (its days were not played)' : broken.length ? `broken ${broken.length} times` : 'kept'}`)
    for (const b of broken?.slice(0, 8) ?? []) out.push(`    ${b}`)
    if (broken && broken.length > 8) out.push(`    … and ${broken.length - 8} more`)
  }
  return out.join('\n')
}
