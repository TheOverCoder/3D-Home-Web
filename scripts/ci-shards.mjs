// CI's shards by measured time, not by test count (update-v1/CHECKS.md §4): Playwright's own --shard deals whole files
// out by how many tests they hold, so the shard with 16-view ran 21 minutes beside one of 9. Here each spec file has its
// seconds (tests/e2e/times.json, refreshed from what tests/e2e/fileTimes.ts prints on CI), and the files are dealt out
// longest first, each to the shard with the least so far. A file not in the table counts its `newFile` seconds.
//
//   node scripts/ci-shards.mjs <k> <n>                 the spec files of shard k of n, on one line (fails on an empty one:
//                                                      Playwright given no file runs every spec)
//   node scripts/ci-shards.mjs --plan <n>              each shard's minutes and files
//   node scripts/ci-shards.mjs --check <n> [--most m]  fails when a spec has no time, a time names no spec, a shard is
//                                                      empty, or the longest would pass m minutes (13)
//   … --full                                           by the night's times (`full`: every test, the @full ones
//                                                      included), for full.yml
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { specFiles } from './affected-specs.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

export const loadTimes = (root = ROOT) => JSON.parse(readFileSync(join(root, 'tests/e2e/times.json'), 'utf8'))

/** The table the night deals by: its own times, in the shape of the push's (`seconds`). */
export const nightTimes = (times) => ({ ...times, seconds: times.full })

/** The files dealt into n shards, longest first, each to the shard with the least seconds so far (the first on a tie);
 *  each shard's files in name order, with its seconds. The same input always gives the same shards. */
export function deal(seconds, files, n, newFile) {
  const time = (f) => seconds[f] ?? newFile
  const shards = Array.from({ length: n }, () => ({ files: /** @type {string[]} */ ([]), seconds: 0 }))
  const order = [...files].sort((a, b) => time(b) - time(a) || a.localeCompare(b))
  for (const f of order) {
    const least = shards.reduce((best, s, i) => (s.seconds < shards[best].seconds ? i : best), 0)
    shards[least].files.push(f)
    shards[least].seconds += time(f)
  }
  for (const s of shards) s.files.sort((a, b) => a.localeCompare(b))
  return shards
}

/** What is wrong with the table or the plan: a spec with no time, a time for no spec, an empty shard, a long one. */
export function problems(times, files, n, mostMinutes) {
  const out = []
  for (const f of files) if (!(f in times.seconds)) out.push(`${f} has no time in tests/e2e/times.json (it counts ${times.newFile} s until it does)`)
  for (const f of Object.keys(times.seconds)) if (!files.includes(f)) out.push(`tests/e2e/times.json times ${f}, which is not a spec`)
  deal(times.seconds, files, n, times.newFile).forEach((s, i) => {
    if (!s.files.length) out.push(`shard ${i + 1} of ${n} is empty`)
    if (s.seconds / 60 > mostMinutes) out.push(`shard ${i + 1} of ${n} would take ${(s.seconds / 60).toFixed(1)} min, over ${mostMinutes}: ${s.files.join(', ')}`)
  })
  return out
}

function main(args) {
  const full = args.includes('--full')
  const argv = args.filter((a) => a !== '--full')
  const times = full ? nightTimes(loadTimes()) : loadTimes()
  const files = specFiles()
  const number = (s, what) => {
    const v = Number(s)
    if (!Number.isInteger(v) || v < 1) throw new Error(`${what} must be a whole number from 1: ${s}`)
    return v
  }
  if (argv[0] === '--check') {
    const n = number(argv[1], 'n')
    const at = argv.indexOf('--most')
    const most = at >= 0 ? Number(argv[at + 1]) : 13
    const found = problems(times, files, n, most)
    for (const p of found) console.error(p)
    if (!found.length) console.error(`${files.length} spec files in ${n} shards, the longest within ${most} min`)
    return found.length ? 1 : 0
  }
  if (argv[0] === '--plan') {
    const n = number(argv[1], 'n')
    deal(times.seconds, files, n, times.newFile).forEach((s, i) => console.log(`shard ${i + 1}: ${(s.seconds / 60).toFixed(1)} min  ${s.files.join(' ')}`))
    return 0
  }
  const n = number(argv[1], 'n')
  const k = number(argv[0], 'k')
  if (k > n) throw new Error(`no shard ${k} of ${n}`)
  const shard = deal(times.seconds, files, n, times.newFile)[k - 1]
  if (!shard.files.length) {
    console.error(`shard ${k} of ${n} is empty: fewer shards, or more spec files`)
    return 1
  }
  console.log(shard.files.map((f) => `tests/e2e/${f}`).join(' '))
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main(process.argv.slice(2))
