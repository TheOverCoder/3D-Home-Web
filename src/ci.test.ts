import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { affected, globToRegExp, kindOf, loadAreas, resolveSpec, specFiles } from '../scripts/affected-specs.mjs'
import { deal, loadTimes, problems } from '../scripts/ci-shards.mjs'

// The checks' own maps (update-v1/CHECKS.md): which e2e specs a changed file reaches (tests/e2e/areas.json, read by
// scripts/affected-specs.mjs) and each spec's time on CI (tests/e2e/times.json, by which scripts/ci-shards.mjs deals the
// files into shards). Both stay complete: a new file of the repository in no area, a new spec no area reaches or with
// no time, an area or a time for nothing fails here, in seconds, not in a wrong list on a merge.

const root = fileURLToPath(new URL('..', import.meta.url))
// every file of the repository, the new ones not yet committed included
const repo = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean)
const map = loadAreas(root)
const specs = specFiles(root)
const times = loadTimes(root)

describe('which specs a change reaches (tests/e2e/areas.json)', () => {
  it('reads globs as paths: ** any directories, * within one, {a,b} either', () => {
    expect(globToRegExp('**/*.md').test('CLAUDE.md')).toBe(true)
    expect(globToRegExp('**/*.md').test('update-v1/missions/01-loop-economy.md')).toBe(true)
    expect(globToRegExp('src/*.ts').test('src/farm/data.ts')).toBe(false)
    expect(globToRegExp('src/farm/**').test('src/farm/machine/queue.ts')).toBe(true)
    expect(globToRegExp('src/farm/{daily,goals}.ts').test('src/farm/goals.ts')).toBe(true)
    expect(globToRegExp('src/farm/{daily,goals}.ts').test('src/farm/goalsView.ts')).toBe(false)
    expect(globToRegExp('scripts/lab-*.mjs').test('scripts/lab-tools.mjs')).toBe(true)
  })

  it('puts every file of the repository in an area', () => {
    const r = affected(repo, map, specs)
    expect(r.unknown, 'files in no area of tests/e2e/areas.json: give them a row').toEqual([])
  })

  it('has no area that matches nothing', () => {
    const empty = map.areas.filter((a) => !repo.some((path) => a.paths.some((glob) => globToRegExp(glob).test(path)))).map((a) => a.name)
    expect(empty).toEqual([])
  })

  it('names only specs that exist, and reaches every spec', () => {
    const refs = [...map.smoke, ...Object.keys(map.heavy), ...map.nightly, ...map.areas.flatMap((a) => a.specs)]
    expect(
      refs.filter((ref) => resolveSpec(ref, specs).length === 0),
      'names of no spec file',
    ).toEqual([])
    const reached = new Set([...map.nightly, ...map.areas.flatMap((a) => a.specs)].flatMap((ref) => resolveSpec(ref, specs)))
    expect(
      specs.filter((f) => !reached.has(f)),
      'specs no area reaches: name each in the areas whose files it tests',
    ).toEqual([])
  })

  it('a spec split in parts is still named by its stem', () => {
    const files = ['16-view-farm.spec.ts', '16-view-house.spec.ts', '16-viewer.spec.ts', '17-stores-orders.spec.ts']
    expect(resolveSpec('16-view', files)).toEqual(['16-view-farm.spec.ts', '16-view-house.spec.ts'])
    expect(kindOf('16-view-house.spec.ts', map).kind).toBe('heavy')
  })

  it('a path takes its areas: a final one stops, a fallback counts alone, the whole suite says so', () => {
    const reach = (path: string) => [...affected([path], map, specs).specs.keys()].sort()
    expect(reach('src/farm/daily.ts')).toEqual(['35-daily.spec.ts'])
    expect(reach('src/farm/daily.test.ts')).toEqual([])
    expect(reach('update-v1/CHECKS.md')).toEqual([])
    expect(reach('tests/e2e/21-goals.spec.ts')).toEqual(['21-goals.spec.ts'])
    expect(reach('src/lib/sculpt/lod.ts')).toEqual(['05-budget-and-fallback.spec.ts', '16-view.spec.ts', '27-far-copies.spec.ts'])
    const everything = affected(['tests/e2e/helpers.ts'], map, specs)
    expect(everything.all).toEqual(['tests/e2e/helpers.ts'])
    expect([...everything.specs.keys()].sort()).toEqual(map.smoke.map((s) => `${s}.spec.ts`).sort())
    const fresh = affected(['src/farm/somethingNew.ts'], map, specs)
    expect(fresh.fallback).toEqual(['src/farm/somethingNew.ts'])
    expect(fresh.specs.size).toBeGreaterThan(0)
    expect(affected(['somewhere/else.txt'], map, specs).unknown).toEqual(['somewhere/else.txt'])
  })
})

describe("each spec's time on CI (tests/e2e/times.json)", () => {
  it('times every spec, and only specs', () => {
    expect(problems(times, specs, 1, Infinity), 'a new spec gets its seconds from the push that first ran it (the job summary of tests/e2e/fileTimes.ts)').toEqual([])
  })

  it('deals each file into exactly one shard, longest first, the same way every time', () => {
    for (let n = 1; n <= 8; n++) {
      const shards = deal(times.seconds, specs, n, times.newFile)
      expect(shards).toHaveLength(n)
      expect(shards.flatMap((s) => s.files).sort()).toEqual(specs)
      expect(deal(times.seconds, specs, n, times.newFile)).toEqual(shards)
      // no shard is longer than an even share and the longest file
      const total = specs.reduce((sum, f) => sum + times.seconds[f], 0)
      const longest = Math.max(...specs.map((f) => times.seconds[f]))
      for (const s of shards) expect(s.seconds).toBeLessThanOrEqual(total / n + longest)
    }
  })

  it('counts a file with no time yet as a new one', () => {
    const shards = deal({ 'a.spec.ts': 100 }, ['a.spec.ts', 'b.spec.ts'], 2, 150)
    expect(shards).toEqual([
      { files: ['b.spec.ts'], seconds: 150 },
      { files: ['a.spec.ts'], seconds: 100 },
    ])
  })
})
