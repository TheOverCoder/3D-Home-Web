// The e2e specs a branch's changes reach, from the map in tests/e2e/areas.json (update-v1/CHECKS.md §1): run those, not
// the whole suite. A path takes the specs of every area it matches; a "final" area stops there (documents, unit tests,
// the lab: nothing to run but `npm run check`); a "fallback" area counts only when nothing else matched (a new file in
// src/farm takes the farm's broad set until it gets a row of its own). src/ci.test.ts keeps the map complete.
//
//   node scripts/affected-specs.mjs [<ref>] [--files <path>…] [--run] [--heavy]
//
// <ref>: what to compare with; by default the merge base with the session's branch (V1_BASE to name another), or, on
// that branch itself, the commit before (a merge: what it brought). Untracked new files count too.
// Prints the specs to run on one line (stdout) and why, with the heavy specs' groups and what runs only at night
// (stderr). --run runs them itself (`npx playwright test --trace off --grep-invert @full …`; nothing when none): never
// pass an empty list to Playwright, which then runs every spec. --heavy adds 05 and 16 to the list, whole.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** A path glob as a regular expression: `**` any directories, `*` and `?` within one, `{a,b}` either. */
export function globToRegExp(glob) {
  let re = ''
  let braces = 0
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*' && glob[i + 1] === '*') {
      // `**/` is any number of whole directories, none included; `**` at the end is anything
      if (glob[i + 2] === '/') {
        re += '(?:.*/)?'
        i += 2
      } else {
        re += '.*'
        i += 1
      }
    } else if (c === '*') re += '[^/]*'
    else if (c === '?') re += '[^/]'
    else if (c === '{') {
      braces++
      re += '(?:'
    } else if (c === '}' && braces > 0) {
      braces--
      re += ')'
    } else if (c === ',' && braces > 0) re += '|'
    else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${re}$`)
}

const compiled = new Map()
const matches = (glob, path) => {
  if (!compiled.has(glob)) compiled.set(glob, globToRegExp(glob))
  return compiled.get(glob).test(path)
}

export const loadAreas = (root = ROOT) => JSON.parse(readFileSync(join(root, 'tests/e2e/areas.json'), 'utf8'))

/** The spec files, by name (`22-xp.spec.ts`), in order. */
export const specFiles = (root = ROOT) =>
  readdirSync(join(root, 'tests/e2e'))
    .filter((f) => f.endsWith('.spec.ts'))
    .sort()

/** The files a spec's name stands for: its own, or those it was split into (`16-view` is `16-view-house.spec.ts`). */
export const resolveSpec = (ref, files) => files.filter((f) => f === `${ref}.spec.ts` || (f.startsWith(`${ref}-`) && f.endsWith('.spec.ts')))

/** How a spec file is run: by its group only (`heavy`, with its `-g`), only at night (`nightly`), or whole (`run`). */
export function kindOf(file, map) {
  for (const [ref, grep] of Object.entries(map.heavy)) if (resolveSpec(ref, [file]).length) return { kind: 'heavy', grep }
  if (map.nightly.some((ref) => resolveSpec(ref, [file]).length)) return { kind: 'nightly' }
  return { kind: 'run' }
}

/** The spec files the paths reach, each with why; and the paths that reach everything, only a fallback, or nothing. */
export function affected(paths, map, files) {
  const specs = new Map()
  const all = []
  const fallback = []
  const unknown = []
  const add = (file, why) => specs.set(file, [...new Set([...(specs.get(file) ?? []), why])])
  const apply = (area, path) => {
    if (area.self) {
      if (files.includes(basename(path))) add(basename(path), 'the spec itself')
      return
    }
    if (area.all) all.push(path)
    for (const ref of area.all ? [...map.smoke, ...area.specs] : area.specs) for (const file of resolveSpec(ref, files)) add(file, area.name)
  }
  for (const path of paths) {
    let matched = false
    let firstFallback = null
    for (const area of map.areas) {
      if (!area.paths.some((glob) => matches(glob, path))) continue
      if (area.fallback) {
        firstFallback ??= area
        continue
      }
      matched = true
      apply(area, path)
      if (area.final) break
    }
    if (!matched && firstFallback) {
      apply(firstFallback, path)
      fallback.push(path)
    } else if (!matched) unknown.push(path)
  }
  return { specs, all, fallback, unknown }
}

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()

function defaultRef() {
  const base = process.env.V1_BASE || 'claude/tender-albattani-7rxfvz'
  try {
    const mergeBase = git('merge-base', 'HEAD', base)
    if (mergeBase !== git('rev-parse', 'HEAD')) return mergeBase
  } catch {
    // no such branch here: compare with the commit before
  }
  return 'HEAD^1'
}

function main(argv) {
  const run = argv.includes('--run')
  const heavyToo = argv.includes('--heavy')
  const at = argv.indexOf('--files')
  const rest = argv.filter((a) => !a.startsWith('--'))
  let paths
  if (at >= 0) paths = argv.slice(at + 1).filter((a) => !a.startsWith('--'))
  else {
    const ref = rest[0] ?? defaultRef()
    paths = [...new Set([...git('diff', '--name-only', ref).split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')])].filter(Boolean)
    console.error(`${paths.length} changed paths since ${ref}`)
  }
  const map = loadAreas()
  const files = specFiles()
  const r = affected(paths, map, files)
  const toRun = []
  for (const [file, why] of [...r.specs].sort(([a], [b]) => a.localeCompare(b))) {
    const k = kindOf(file, map)
    if (k.kind === 'run' || (k.kind === 'heavy' && heavyToo)) {
      toRun.push(`tests/e2e/${file}`)
      console.error(`  ${file}: ${why.join('; ')}`)
    } else if (k.kind === 'heavy') console.error(`  heavy, its group only: npx playwright test tests/e2e/${file} ${k.grep}  (${why.join('; ')})`)
    else console.error(`  at night only (@full): ${file}`)
  }
  if (r.all.length) console.error(`Reaches every spec (${r.all.join(', ')}): the smoke specs here, the whole core on CI (a wip/ branch push).`)
  if (r.fallback.length) console.error(`Only a fallback row maps ${r.fallback.join(', ')}: give it a row of its own in tests/e2e/areas.json.`)
  if (r.unknown.length) console.error(`Not in tests/e2e/areas.json: ${r.unknown.join(', ')} (src/ci.test.ts fails until it is).`)
  if (!toRun.length) {
    console.error('No spec to run here: `npm run check` is the check.')
    return 0
  }
  if (!run) {
    console.log(toRun.join(' '))
    return 0
  }
  const env = { ...process.env }
  if (!env.PW_CHROMIUM_PATH && existsSync('/opt/pw-browsers/chromium')) env.PW_CHROMIUM_PATH = '/opt/pw-browsers/chromium'
  // node itself runs Playwright's command line (on Windows `npx` is a .cmd that Node will not start without a shell)
  const cli = join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js')
  return spawnSync(process.execPath, [cli, 'test', '--trace', 'off', '--grep-invert', '@full', ...toRun], { cwd: ROOT, stdio: 'inherit', env }).status ?? 1
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main(process.argv.slice(2))
