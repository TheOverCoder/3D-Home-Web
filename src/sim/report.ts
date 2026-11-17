// The pace simulation's report (npm run sim): the minutes of play to each level, the coins as play goes on, what was
// bought, and every stretch with nothing useful to do — as plain text, with each level's band from PACE beside it.

import { LADDERS, TOOL_KINDS, TOOLS, toolLadder, type LadderId } from '../farm/data'
import { toolBoughtAt, type SimRun } from './play'
import { PACE } from './targets'

/** Minutes as m:ss. */
export const mmss = (minutes: number) => {
  const s = Math.round(minutes * 60)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

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
