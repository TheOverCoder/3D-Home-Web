import { appendFileSync } from 'node:fs'
import { basename } from 'node:path'
import type { FullConfig, Reporter, Suite, TestCase } from '@playwright/test/reporter'

/**
 * A reporter for CI (update-v1/CHECKS.md §4): each spec file's seconds in this run, and every test that was flaky (it
 * passed only on a retry) or failed, by name. They go into the job's summary (GITHUB_STEP_SUMMARY) and the log, the
 * seconds as JSON ready to copy into tests/e2e/times.json, by which scripts/ci-shards.mjs deals the files out (from a
 * push's run, never the night's: its @full tests would count). A file's time runs from the end of the test before it
 * to the end of its own last one, so the boot and the fixtures count where they happen, as on the shard's clock.
 * It goes beside the list reporter: `['./tests/e2e/fileTimes.ts']` in playwright.config.ts's reporters.
 */
export default class FileTimes implements Reporter {
  private suite: Suite | undefined
  private last = Date.now()
  private seconds = new Map<string, number>()

  onBegin(_config: FullConfig, suite: Suite) {
    this.suite = suite
    this.last = Date.now()
  }

  onTestEnd(test: TestCase) {
    const now = Date.now()
    const file = basename(test.location.file)
    this.seconds.set(file, (this.seconds.get(file) ?? 0) + (now - this.last) / 1000)
    this.last = now
  }

  onEnd() {
    const tests = this.suite?.allTests() ?? []
    const named = (t: TestCase) => `${basename(t.location.file)} › ${t.titlePath().slice(3).join(' › ')}`
    const flaky = tests.filter((t) => t.outcome() === 'flaky').map(named)
    const failed = tests.filter((t) => t.outcome() === 'unexpected').map(named)
    const times = Object.fromEntries([...this.seconds].sort(([a], [b]) => a.localeCompare(b)).map(([f, s]) => [f, Math.round(s)]))
    const total = Object.values(times).reduce((a, b) => a + b, 0)
    const json = JSON.stringify(times)
    console.log(`\nSeconds a spec file (${(total / 60).toFixed(1)} min): ${json}`)
    if (flaky.length) console.log(`Flaky, passed only on a retry: ${flaky.join('; ')}`)
    const summary = process.env.GITHUB_STEP_SUMMARY
    if (!summary) return
    const rows = Object.entries(times)
      .sort(([, a], [, b]) => b - a)
      .map(([f, s]) => `| ${f} | ${(s / 60).toFixed(1)} |`)
    const lines = [
      `### Spec files, ${(total / 60).toFixed(1)} min`,
      '',
      '| File | Min |',
      '|---|---|',
      ...rows,
      '',
      `For tests/e2e/times.json: \`${json}\``,
      '',
      ...(flaky.length ? ['**Flaky** (passed only on a retry):', ...flaky.map((t) => `- ${t}`), ''] : ['No flaky test.', '']),
      ...(failed.length ? ['**Failed:**', ...failed.map((t) => `- ${t}`), ''] : []),
    ]
    appendFileSync(summary, `${lines.join('\n')}\n`)
  }

  printsToStdio() {
    return false
  }
}
