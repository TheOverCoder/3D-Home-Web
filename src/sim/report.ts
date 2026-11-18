// The pace simulation's report (npm run sim): the minutes of play to each level, the coins as play goes on, what was
// bought, and every stretch with nothing useful to do — as plain text, with each level's band from PACE beside it.

import { LADDERS, TOOL_KINDS, TOOLS, toolLadder, type LadderId } from '../farm/data'
import { incomeAt } from '../farm/economy'
import { clock } from '../lib/time'
import { holes, type VisitNews } from './journey'
import { incomeOver, toolBoughtAt, type SimRun } from './play'
import { JOURNEY, PACE } from './targets'

/** Minutes of play as the game's clock writes them (src/lib/time.ts): 4:05, 1:02:10. */
export const mmss = (minutes: number) => clock(minutes * 60)

export function report(run: SimRun, levels = 30): string {
  const out: string[] = []
  out.push(
    `A new farm, played ${Math.round(run.minutes)} minutes by the good player (seed ${run.seed}; ${run.open ? 'everything open' : 'locked by the level'}; ${run.tools ? 'the tools for sale' : 'no tools for sale'})`,
    '',
  )
  out.push('Level  reached  since last  band (PACE)', '    1     0:00')
  for (let l = 2; l <= levels; l++) {
    const at = run.levelAt[l]
    const before = run.levelAt[l - 1]
    const band = PACE.levels[l]
    const mark = band && at !== undefined ? (at < band[0] ? '  too soon' : at > band[1] ? '  too late' : '') : band ? '  not reached' : ''
    out.push(
      `${String(l).padStart(5)}  ${(at === undefined ? '—' : mmss(at)).padStart(7)}  ${(at !== undefined && before !== undefined ? mmss(at - before) : '').padStart(10)}  ${band ? `${band[0]}–${band[1]} min` : ''}${mark}`,
    )
  }
  out.push('', 'Minute  coins  level      XP')
  for (const s of run.samples) out.push(`${String(s.minute).padStart(6)}  ${String(s.coins).padStart(5)}  ${String(s.level).padStart(5)}  ${String(s.xp).padStart(6)}`)
  out.push('', `Gaps with nothing useful to do, over 2 min (${run.gaps.length}):`)
  for (const g of run.gaps) out.push(`  ${mmss(g.from / 60)} – ${mmss(g.to / 60)} (${mmss((g.to - g.from) / 60)}): waiting for ${g.waiting}; then ${g.ended}`)
  if (!run.gaps.length) out.push('  none')
  out.push(`  (the longest wait: ${Math.round(run.longest.seconds)} s, from ${mmss(run.longest.minute)})`)
  out.push('', run.tools ? `The animals' tools and the remotes (each tool within ${PACE.tools.within} min of its herd full):` : "The animals' tools and the remotes: not for sale")
  if (run.tools) {
    const when = (m: number | undefined) => (m === undefined ? '—' : mmss(m))
    for (const kind of TOOL_KINDS) {
      const { at, after } = toolBoughtAt(run, kind)
      const late = after !== undefined && after > PACE.tools.within ? '  too late' : ''
      // the steps of a ladder bought, and the minute of its top
      const steps = (part: 'hold' | 'tap') => {
        const id = toolLadder(kind, part)
        const n = run.shop[id]?.length ?? 0
        return `${n}/${LADDERS[id].levels}${n >= LADDERS[id].levels ? ` (top ${when(run.shop[id]![n - 1])})` : ''}`
      }
      out.push(
        `  ${TOOLS[kind].name.padEnd(12)} herd full ${when(run.herdFull[kind]).padStart(6)}  bought ${when(at).padStart(6)}${after === undefined ? '' : ` (${mmss(after)} after)`}${late}  holds ${steps('hold')}, a tap ${steps('tap')}`,
      )
    }
    for (const id of ['machine-remote', 'animal-remote'] as LadderId[]) out.push(`  ${LADDERS[id].name.padEnd(12)} bought ${when(run.shop[id]?.[0])}`)
    // the tools' skins (src/farm/skins.ts): when each was bought
    const skins = run.bought.filter((b) => b.what.startsWith('buy skin '))
    out.push(`  Skins        ${skins.length ? skins.map((b) => `${b.what.slice('buy skin '.length)} ${mmss(b.minute)}`).join(', ') : 'none bought'}`)
  }
  out.push('', 'Bought:')
  for (const b of run.bought) out.push(`  ${mmss(b.minute)}  ${b.what}`)
  out.push('', 'Moves (how many, the XP they gave):')
  for (const [k, m] of Object.entries(run.moves).sort((a, b) => b[1].xp - a[1].xp)) out.push(`  ${k.padEnd(10)} ${String(m.n).padStart(5)} ${String(m.xp).padStart(6)}`)
  return out.join('\n')
}

/** A night as PACE.night judges it: the morning of `day`'s return (what it brought, net, in minutes of play's income
 *  at its level), and what the evening before had on its way through the night and within a short break. Null when
 *  the journey has no such morning. */
export function nightOf(news: readonly VisitNews[], day: number) {
  const k = news.findIndex((v) => v.day === day)
  if (k < 1 || !news[k].back) return null
  const level = news[k].level[0]
  const worth = news[k].back!.worth
  return { level, worth, minutes: worth / incomeAt(level), within: news[k - 1].left.within, brk: news[k - 1].left.brk }
}

/** The rules of PACE beyond the levels, on every seed: the good player's runs (play pays more as it goes on; the first
 *  hour's rewards) and each seed's journey on the session runner (the first sitting, the nights, full stores). */
export function paceReport(runs: readonly SimRun[], journeys: readonly { seed: number; news: VisitNews[] }[]): string {
  const out: string[] = ['PACE beyond the levels (seeds ' + runs.map((r) => r.seed).join(', ') + ')', '']
  const pct = (n: number) => `${Math.round(n * 100)} %`
  const { low, high, times } = PACE.income
  const lo = incomeOver(runs, low)
  const hi = incomeOver(runs, high)
  out.push(`  income: ${lo.toFixed(1)} coins a minute over levels ${low.join('–')}, ${hi.toFixed(1)} over ${high.join('–')}: ${(hi / lo).toFixed(2)}× (at least ${times}×)`)
  for (const r of runs) {
    const s = r.samples.find((x) => x.minute === PACE.rewards.within)?.rewards
    if (!s) continue
    const all = s.small + s.medium + s.big + s.huge
    out.push(`  rewards, seed ${r.seed}, first ${PACE.rewards.within} min: ${all} paid, ${pct(s.small / all)} small, ${pct((s.big + s.huge) / all)} big or huge`)
  }
  for (const j of journeys) {
    const first = j.news[0]?.pull
    out.push(`  seed ${j.seed}: the first sitting ends with ${first ? `${first.what} in ${clock(first.seconds)}` : 'nothing'} on its way (at least ${clock(PACE.first.seconds)})`)
    for (const day of PACE.night.days) {
      const n = nightOf(j.news, day)
      if (!n) continue
      out.push(
        `    the night before day ${day}: ${Math.round(n.worth)} coins at level ${n.level}, ${n.minutes.toFixed(0)} min of play (${PACE.night.minutes.join('–')}); on its way that evening ${Math.round(n.within)}, within ${clock(PACE.night.break.seconds)} ${Math.round(n.brk)}`,
      )
    }
    const full = holes(j.news).full
    out.push(`    full stores: ${full === null ? 'not judged' : full.length ? full.join('; ') : `kept (at most ${pct(JOURNEY.full.share)} of returns from day ${JOURNEY.full.from})`}`)
  }
  return out.join('\n')
}
