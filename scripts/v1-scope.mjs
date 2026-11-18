// Update v1: does a build agent's branch stay inside its row of update-v1/RUN.md §1? The rows are update-v1/owners.json.
// Each file the branch changed (against where it left the session branch) is owned by the agent, one it may touch (its
// row says how: printed, for the reviewer to check), one anyone may touch in a stated way, never to be committed, or
// outside the row. A unit test counts with the file it stands beside. Exits 1 when a file is outside or never to be
// committed, 2 on a wrong call. It reads only: nothing is merged or changed.
//
//   node scripts/v1-scope.mjs <branch> [--agent <id>] [--base <ref>] [--owners <file>]
//   node scripts/v1-scope.mjs --which <branch>      prints the agent the branch belongs to, or nothing
//
// The agent is --agent, else `git config branch.<branch>.v1agent`, else the end of the branch's name (…/02a, …-p0-split).
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OWNERS = join(dirname(fileURLToPath(import.meta.url)), '../update-v1/owners.json')
// at most this many paths a list prints, so a report stays one screen
const LIST_MOST = 12

/** {a,b} in a glob as the globs it stands for. */
function expandBraces(glob) {
  const m = /\{([^{}]*)\}/.exec(glob)
  if (!m) return [glob]
  return m[1].split(',').flatMap((alt) => expandBraces(glob.slice(0, m.index) + alt + glob.slice(m.index + m[0].length)))
}

/** A glob as a regular expression over a whole path: * within a folder, ** across folders, ? one letter, {a,b} either. */
export function globToRegExp(glob) {
  const one = (g) => {
    let re = ''
    for (let i = 0; i < g.length; i++) {
      const c = g[i]
      if (c === '*' && g[i + 1] === '*') {
        // '**/' is any number of whole folders, '**' anything at all
        if (g[i + 2] === '/') {
          re += '(?:[^/]+/)*'
          i += 2
        } else {
          re += '.*'
          i += 1
        }
      } else if (c === '*') re += '[^/]*'
      else if (c === '?') re += '[^/]'
      else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&')
    }
    return re
  }
  return new RegExp(`^(?:${expandBraces(glob).map(one).join('|')})$`)
}

const compiled = new Map()
/** Whether a path matches a glob (compiled once). */
export function matches(path, glob) {
  let re = compiled.get(glob)
  if (!re) compiled.set(glob, (re = globToRegExp(glob)))
  return re.test(path)
}

/** The sources a unit test may stand beside: dir/name.test.ts beside dir/name.ts; dir/a.b.test.ts beside dir/a.ts,
 *  dir/a/b.ts or dir/b.ts (state.season.test.ts beside state/season.ts). None for a file that is not a unit test. */
export function besides(path) {
  const m = /^(.*\/)?([^/]+)\.test\.tsx?$/.exec(path)
  if (!m) return []
  const dir = m[1] ?? ''
  const parts = m[2].split('.')
  const names = new Set([parts.join('.'), parts[0], parts.join('/'), parts[parts.length - 1]])
  return [...names].flatMap((n) => [`${dir}${n}.ts`, `${dir}${n}.tsx`])
}

/** Each changed file sorted against one agent's row. `touched` and `anyone` carry how the row allows the change. */
export function scope(files, owners, agent) {
  const row = owners.agents[agent]
  if (!row) throw new Error(`no row for ${agent} in owners.json`)
  const owned = (p) => row.owns.some((g) => matches(p, g))
  const touchOf = (p) => row.touch.find((t) => matches(p, t.path))
  const out = { owned: [], touched: [], anyone: [], outside: [], never: [] }
  for (const file of files) {
    if (owners.never.some((g) => matches(file, g))) {
      out.never.push(file)
      continue
    }
    if (owned(file) || besides(file).some(owned)) {
      out.owned.push(file)
      continue
    }
    const touch = touchOf(file) ?? besides(file).map(touchOf).find(Boolean)
    if (touch) {
      out.touched.push({ file, how: touch.how })
      continue
    }
    const any = owners.anyone.find((t) => matches(file, t.path))
    if (any) out.anyone.push({ file, how: any.how })
    else out.outside.push(file)
  }
  return out
}

/** The files among these that RUN.md §2 calls hot. */
export const hotFiles = (files, owners) => files.filter((f) => owners.hot.some((g) => matches(f, g)))

/** The agent a branch belongs to: the one configured for it, else the agent whose id ends the branch's name. */
export function agentOf(branch, ids, configured) {
  if (configured && ids.includes(configured)) return configured
  const name = branch.toLowerCase()
  const hits = ids.filter((id) => {
    const low = id.toLowerCase()
    return name === low || ['/', '-', '_'].some((sep) => name.endsWith(sep + low))
  })
  return hits.sort((a, b) => b.length - a.length)[0] ?? null
}

/** The report, one screen at most. */
export function report(result, meta) {
  const lines = [`v1-scope ${meta.agent} · ${meta.branch} against ${meta.base} · ${meta.count} files`]
  const list = (items, show) => {
    for (const it of items.slice(0, LIST_MOST)) lines.push(`    ${show(it)}`)
    if (items.length > LIST_MOST) lines.push(`    … and ${items.length - LIST_MOST} more`)
  }
  lines.push(`  owned      ${result.owned.length}`)
  lines.push(`  may touch  ${result.touched.length}${result.touched.length ? '  (check each is the change its row allows)' : ''}`)
  list(result.touched, (t) => `${t.file} — ${t.how}`)
  lines.push(`  anyone     ${result.anyone.length}`)
  list(result.anyone, (t) => `${t.file} — ${t.how}`)
  lines.push(`  outside    ${result.outside.length}${result.outside.length ? `  ← not in ${meta.agent}'s row` : ''}`)
  list(result.outside, (f) => f)
  lines.push(`  never      ${result.never.length}${result.never.length ? '  ← never committed by an agent' : ''}`)
  list(result.never, (f) => f)
  if (meta.hot?.length) lines.push(`  hot        ${meta.hot.join(', ')}`)
  const bad = result.outside.length + result.never.length
  lines.push(bad ? `OUTSIDE THE ROW: ${bad} file${bad === 1 ? '' : 's'}` : 'OK: inside the row')
  return lines.join('\n')
}

function main(argv) {
  const opts = { agent: null, base: null, owners: OWNERS, which: false }
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--agent') opts.agent = argv[++i]
    else if (a === '--base') opts.base = argv[++i]
    else if (a === '--owners') opts.owners = argv[++i]
    else if (a === '--which') opts.which = true
    else rest.push(a)
  }
  const branch = rest[0]
  if (!branch) {
    console.error('usage: node scripts/v1-scope.mjs <branch> [--agent <id>] [--base <ref>] [--owners <file>]')
    return 2
  }
  const owners = JSON.parse(readFileSync(opts.owners, 'utf8'))
  const ids = Object.keys(owners.agents)
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  let configured = null
  try {
    configured = git('config', '--get', `branch.${branch}.v1agent`)
  } catch {
    // not configured: the branch's name decides
  }
  const agent = opts.agent ?? agentOf(branch, ids, configured)
  if (opts.which) {
    if (agent) console.log(agent)
    return agent ? 0 : 1
  }
  if (!agent || !owners.agents[agent]) {
    console.error(`v1-scope: whose row is ${branch}? Pass --agent <id> (${ids.join(', ')}),`)
    console.error(`or set it once: git config branch.${branch}.v1agent <id>`)
    return 2
  }
  const base = opts.base ?? owners.base
  let files
  try {
    files = git('diff', '--name-only', '--no-renames', `${base}...${branch}`).split('\n').filter(Boolean)
  } catch {
    console.error(`v1-scope: cannot compare ${branch} with ${base}`)
    return 2
  }
  const result = scope(files, owners, agent)
  console.log(report(result, { agent, branch, base, count: files.length, hot: hotFiles(files, owners) }))
  return result.outside.length + result.never.length ? 1 : 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)))
