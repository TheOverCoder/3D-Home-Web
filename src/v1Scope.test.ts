import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { agentOf, besides, globToRegExp, hotFiles, matches, report, scope, type Owners } from '../scripts/v1-scope.mjs'

// scripts/v1-scope.mjs: whether an update v1 build agent's branch stays inside its row (update-v1/RUN.md §1, as data in
// update-v1/owners.json). Judged on made-up rows, then the real file is held to RUN.md's list of agents.

const owners: Owners = {
  base: 'session',
  never: ['package.json', 'lab/audit.json'],
  anyone: [{ path: 'tests/README.md', how: 'your rows' }],
  hot: ['src/farm/data.ts', 'tests/README.md'],
  agents: {
    x1: { phase: 1, owns: ['src/farm/state/season.ts', 'src/sim/**', 'tests/e2e/46-*.spec.ts'], touch: [{ path: 'src/farm/{data,decor}.ts', how: 'rows' }] },
    y2: { phase: 2, owns: ['src/ui/Shell.tsx'], touch: [] },
  },
}

describe('globs', () => {
  it('* stays in a folder, ** crosses folders, {a,b} is either', () => {
    expect(matches('src/sim/a/b/c.ts', 'src/sim/**')).toBe(true)
    expect(matches('src/simx.ts', 'src/sim/**')).toBe(false)
    expect(matches('tests/e2e/46-seasons.spec.ts', 'tests/e2e/46-*.spec.ts')).toBe(true)
    expect(matches('tests/e2e/46/x.spec.ts', 'tests/e2e/46-*.spec.ts')).toBe(false)
    expect(matches('src/a/b/c.css', 'src/**/*.css')).toBe(true)
    expect(matches('src/farm/decor.ts', 'src/farm/{data,decor}.ts')).toBe(true)
    expect(matches('src/farm/dataXts', 'src/farm/{data,decor}.ts')).toBe(false)
    expect(globToRegExp('src/{a,b/{c,d}}.ts').test('src/b/d.ts')).toBe(true)
  })

  it('a unit test stands beside its source, or beside the module its middle names', () => {
    expect(besides('src/farm/road.test.ts')).toContain('src/farm/road.ts')
    expect(besides('src/farm/state.season.test.ts')).toEqual(expect.arrayContaining(['src/farm/state/season.ts', 'src/farm/season.ts']))
    expect(besides('src/farm/road.ts')).toEqual([])
  })
})

describe('a branch against its row', () => {
  const files = [
    'src/farm/state/season.ts',
    'src/farm/state.season.test.ts',
    'src/sim/policy.ts',
    'src/farm/data.ts',
    'src/farm/decor.test.ts',
    'tests/README.md',
    'src/ui/Hud.tsx',
    'package.json',
    'src/ui/Shell.tsx',
  ]
  const r = scope(files, owners, 'x1')

  it('sorts each file once: owned, may touch (with how), anyone, outside, never', () => {
    expect(r.owned).toEqual(['src/farm/state/season.ts', 'src/farm/state.season.test.ts', 'src/sim/policy.ts'])
    expect(r.touched).toEqual([
      { file: 'src/farm/data.ts', how: 'rows' },
      { file: 'src/farm/decor.test.ts', how: 'rows' },
    ])
    expect(r.anyone).toEqual([{ file: 'tests/README.md', how: 'your rows' }])
    expect(r.outside).toEqual(['src/ui/Hud.tsx', 'src/ui/Shell.tsx'])
    expect(r.never).toEqual(['package.json'])
    expect(r.owned.length + r.touched.length + r.anyone.length + r.outside.length + r.never.length).toBe(files.length)
  })

  it("another agent's file is outside, and a file no one may commit stays never, even when a glob owns it", () => {
    expect(scope(['src/ui/Shell.tsx'], owners, 'y2').outside).toEqual([])
    const greedy: Owners = { ...owners, agents: { z: { phase: 0, owns: ['**'], touch: [] } } }
    expect(scope(['package.json', 'src/a.ts'], greedy, 'z')).toMatchObject({ never: ['package.json'], owned: ['src/a.ts'] })
    expect(() => scope([], owners, 'nobody')).toThrow()
  })

  it('names the hot files, and the report ends on its verdict', () => {
    expect(hotFiles(files, owners)).toEqual(['src/farm/data.ts', 'tests/README.md'])
    const text = report(r, { agent: 'x1', branch: 'v1/x1', base: 'session', count: files.length })
    expect(text).toContain('src/ui/Hud.tsx')
    expect(text).toContain('src/farm/data.ts — rows')
    expect(text.split('\n').at(-1)).toBe('OUTSIDE THE ROW: 3 files')
    expect(
      report(scope(['src/sim/a.ts'], owners, 'x1'), { agent: 'x1', branch: 'b', base: 's', count: 1 })
        .split('\n')
        .at(-1),
    ).toBe('OK: inside the row')
  })
})

describe('whose branch', () => {
  const ids = ['P0-split', '02a', '07c', 'x1']
  it('the configured agent first, else the id that ends the name', () => {
    expect(agentOf('worktree-agent-abc', ids, '07c')).toBe('07c')
    expect(agentOf('v1/02a', ids)).toBe('02a')
    expect(agentOf('update-v1-p0-split', ids)).toBe('P0-split')
    expect(agentOf('feature/x12', ids)).toBeNull()
    expect(agentOf('worktree-agent-abc', ids, 'nobody')).toBeNull()
  })
})

describe('update-v1/owners.json', () => {
  const real = JSON.parse(readFileSync('update-v1/owners.json', 'utf8')) as Owners
  // the agents of RUN.md §1's tables ("| **02a** · L |"), and phase 3's two
  const run = readFileSync('update-v1/RUN.md', 'utf8')
  const listed = [...run.matchAll(/^\| \*\*([\w-]+)\*\* ·/gm)].map((m) => m[1])

  it('has a row for every agent in RUN.md, and none it does not name', () => {
    expect(listed.length).toBeGreaterThan(25)
    expect(Object.keys(real.agents).sort()).toEqual([...listed, 'P3-play', 'P3-budget'].sort())
  })

  it('every glob compiles, every touch says how, and no agent owns what is never committed', () => {
    for (const [id, row] of Object.entries(real.agents)) {
      for (const g of [...row.owns, ...row.touch.map((t) => t.path)]) expect(() => globToRegExp(g), `${id}: ${g}`).not.toThrow()
      for (const t of row.touch) expect(t.how, `${id}: ${t.path}`).toBeTruthy()
      for (const never of real.never)
        expect(
          row.owns.some((g) => matches(never, g)),
          `${id} owns ${never}`,
        ).toBe(false)
    }
  })
})
