# Update v1: how it is checked

How update v1 is tested while many agents build it on one machine: what each agent runs, how many may run browsers at
once, what must be green between phases, and how CI stays near 15 minutes. **Order, owners and briefs are in
`RUN.md`**; this file is only about checks. "Measured" means taken on 2026-11-18, on this machine or from CI runs 131
and 134 (the last two green pushes).

## What was measured

**The machine:** 4 cores and 15 GB. Every worktree uses the main checkout's `node_modules` (a symlink, or found by
walking up). **`npm run check`, alone:** about 50 s (tsc 3.5, oxlint 2.7, Vitest 31, Prettier 12), not CLAUDE.md's
15 s; 1,005 unit tests in 100 files.

**The heaviest unit tests**, alone:

| Test | Time | Timeout |
|---|---|---|
| `state.market`'s "no more are ever inside…" | 4.9 s | its own, 60 s |
| `save.property`'s two | 4.4 s and 3.6 s | its own `TIME`, 22 s |
| `lod`'s "each moves no surface…" | 2.0 s | **none of its own: Vitest's 5 s** |

**Unit tests under load:**

| Load | `lod`'s test | Vitest's wall time |
|---|---|---|
| Two browser runs going | failed (5.3 s) | 80 s |
| Three `check`s at once | failed in all three (5.7–6.5 s) | 71 s each |
| Three at once, each `--maxWorkers=2` | failed in all three (5.8–6.8 s) | 103 s each |
| Three at once, each `--maxWorkers=1` | passed (slowest test 5.9 s) | 103 s each |

At 08:37, with other agents at work, the load average was 22–26 from two browsers and up to five Vitest runs. One
agent was already passing `--testTimeout=60000` by hand.

**One e2e run:** the build takes 4.5 s and booting the shared page about 40 s; one software-WebGL browser uses about
2.3 cores (its GPU process 150 %, its page 80 %). Alone, with build and boot: `12-models` 45 s, `36-unlocks` 76 s,
`21-goals` 79 s, `37-first-steps` 87 s, `03-settings` 88 s, `14-hud` 90 s, `25-button` 97 s, `35-daily` 153 s,
`17-stores-orders` 154 s, `22-xp` 236 s, `07-phone` (a phone page of its own) 283 s.

**Browser runs at once** (`37`, each run on its own port; all passed):

| Runs at once | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Each run (s) | 87 | 107 | 153 | 213 |
| Seconds a run, overall | 87 | 53 | 51 | 53 |
| Load average | about 3 | 6.7 | 12.4 | 19.2 |

From two runs on, the machine does no more work: a third or fourth run only waits, and stretches every timeout.

**CI:**
- `37`'s tests take 65 s there, after the shard's boot: a spec's CI minutes are about its time here, less the boot.
- Shard test steps (run 134): 12.8, **20.8**, 12.5, 8.8, 10.0 and 10.5 min, 75 min in all; a push waits 22–24 min.
  Shard 2 is mostly `16-view` (18.1 min). Playwright deals whole files to shards by test count (26, 28, 18, 26, 23,
  23), never by time.
- 37 of the last 100 runs were cancelled by a newer push, most of them docs-only. The last three red pushes:
  `12-models`' hand-kept gallery list twice (runs 106, 107), `17-stores-orders`' "orders at the office" after its
  retry (111). The nightly was red 3 times in 7.

**A stale server:** a killed run can leave `vite preview` on its port (it happened here), and locally Playwright reuses
whatever answers there (`reuseExistingServer`): the next run on that port silently tests an old build.

## 1. The local check, by kind of change

**Always** `npm run check` (50 s alone, 80 s or more under load; while iterating, `npx vitest run <file>` takes
seconds). **Then only the specs below**, each with `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test
--trace off --grep-invert @full <file>`, through the lock (§2) once it exists. The times include build and boot.

| Kind of change | Unit tests beyond `check` | e2e | Here, alone |
|---|---|---|---|
| **Data rows** (a crop, recipe, unlock, garment, person, sound or album row) | `npm run sim` when a price, time or XP changes (seconds; `pace.test` is in `check`) | Only where the row shows: `36-unlocks` for an unlock (76 s), `32-machine-queue` for a recipe, `28-wardrobe` for a garment (about 1 min each) | 2–2.5 min |
| **A pure engine** (calendar, road, tier, the queue's core) | Its own test; `journey.test` if it feeds the journey (both are in `check`) | None | 1 min |
| **A save field** | `FC_RUNS=1000 npx vitest run src/farm/save.property.test.ts`, once before handing in (about 30 s, estimated) | None, unless the field is shown: then that panel's spec | 1.5 min |
| **A panel, or the top of the screen** | — | <ul><li>Its own spec (1–2.5 min).</li><li>`22-xp` (236 s) if it touches `TopStack`, `HudMode`, `TopDash` or the toasts.</li><li>`25-button` (97 s) if it adds a button or an interactable.</li><li>`39-panels`, once 07 lands it.</li></ul> | 3–8 min |
| **A 3D model** | `checks.test` and `weights.test` (in `check`) | <ul><li>`12-models` (45 s).</li><li>`27-far-copies` (about 5 min) for a crowd part.</li><li>`05 -g "the walk at"` (about 3 min, estimated from CI), only if the model casts or adds to a view.</li></ul> | 1.5–9 min |
| **A scene** (lighting, `src/lib/visibility`, walk-ins, `Land`, maps) | — | <ul><li>`16-view -g "<its group>"`: 40 s of boot, plus 0.3–3.8 min a group.</li><li>`05 -g "the walk at"`.</li><li>`29-maps` for the maps.</li></ul> | 5–9 min |
| **Sound** | The `sounds`, `palette` and `mix` tests (in `check`) | `03-settings` (88 s; 06's sound measure lives there) | 2.5 min |
| **Cross-cutting** (`helpers.ts`, `ready()`, the state split, `PanelSheet`, `cardQueue`, `App.tsx`) | — | Not here: I push the branch as `wip/<mission>` for one run of the whole core on CI (its shards side by side, no load here) | CI |

**The hot specs**, reached by most missions: `25-button` and `05` (8 missions each), `16-view` (7), `22-xp` (6),
`17-stores-orders` and `37-first-steps` (4). An agent whose change reaches one runs it, even when its own spec is
elsewhere.

**A new spec, before it is handed in:**
- Run it 3 times in a row (`--repeat-each=3`).
- Run it once after a hot spec on the same page, for example `npx playwright test … 22-xp.spec.ts <new>.spec.ts`.
  This shows any switch it leaves on (§4).

## 2. Machine load

**How many browser runs at once: two.**
- From two on, the work done stays flat (53 s a run at 2, 51 at 3, 53 at 4), while each run's latency and the strain
  on every timeout grow: at four, 213 s and a load of 19.
- With two browsers going, the unit tests already time out.
- `05` (the drawing-free context) and `16-view` each count as one run, and a long one. Locally, run only their `-g`
  group.

**The rule:**
1. **A lock for browsers.**
   - At most **2** Playwright runs on the machine, through `scripts/e2e-lock.mjs` (§6).
   - A third run waits, and says who holds the slots.
   - My merge check takes both slots (`--all`).
2. **Room for the unit tests, not a cap on workers.** `testTimeout: 20_000` in `vitest.config.ts`, about three times
   the slowest test seen under load at 5 s (6.8 s); the heavy tests keep their own, longer ones. `--maxWorkers=2` did
   not stop the timeout; `--maxWorkers=1` did, but is about 3× slower on a free machine (86 s of CPU on one core). A
   hang now takes 20 s to fail instead of 5.
3. **No `npm ci` or `npm install`** in the main checkout while an agent works: every worktree runs from that
   `node_modules`.
4. **One run per worktree at a time:** two runs in one worktree would build over each other's `dist/`.

**Ports:**
- **Assignment:** `E2E_PORT = 4400 + 10 × mission + k`, where `k` (0–9) is the agent's place among its mission's
  agents in `RUN.md`: mission 01 uses 4410–4419, 08 uses 4480–4489, 11 uses 4510–4519. My merge checkout keeps
  4185; ad-hoc measuring uses 4600 and up.
- **A port that already answers is refused, never reused.** The lock checks that the port is free and sets
  `E2E_FRESH=1` (`reuseExistingServer` off). It runs the command in a process group of its own and ends the whole
  group, so no `vite preview` is left behind.

## 3. Gates

**Each merge** (the checklist is §5):
- `npm run check` and the affected specs, run on the **merged** tree.
- Push. CI must be green, with no flaky test, before the next merge that reaches the same hot spec.
- Merges that reach different hot specs may share a push, three at most, so a red push is cheap to split.
- A red push is reverted (`git revert -m 1 <merge>`) unless its fix is a line of test code. The agent fixes it on its
  branch.

**Between phases:**

| Gate | Green before the next phase starts |
|---|---|
| **0 → 1** (08 alone; nobody branches before it) | <ul><li>CI green on 08's commits 1–4, `PanelGuard` and `cardQueue`, with no flaky test.</li><li>One **Full suite run by hand** (`full.yml`, Run workflow) green: the split of `state.ts` must change nothing.</li><li>The longest shard at 12 min or less (08's own bound).</li><li>`npm run sim` prints the same table as before the split.</li><li>`journey.test`'s `DEBTS` still the four (`quiet`, `burst`, `pull`, `full`).</li><li>The lock and the Vitest timeout (§6) in, so phase 1's agents can run side by side.</li></ul> |
| **1 → 2** | <ul><li>Each engine's merge green on CI.</li><li>`39-panels` in, in report mode, with its debts listed.</li><li>`05`'s sun-pass headroom measured again after 11's sun box (D1 plans 5 draws left).</li><li>`16-view` green with 05's frozen pose and 11's poses.</li><li>`27` green.</li><li>`PACE` and `DEBTS` unchanged: the engines change no numbers.</li><li>One nightly green on the phase's head.</li></ul> |
| **2 → 3** | <ul><li>Every mission's "Done when" specs green on the merged head.</li><li>`DEBTS` empty, each line removed by the mission that paid it.</li><li>`PACE` to level 30.</li><li>`05` with no debt beyond its list (the last mission to land on the farm's views measured it: D1, D2).</li><li>`16-view` whole and `26-counting` green in the nightly.</li><li>The last three pushes at 15 min or less.</li><li>Two nights green in a row.</li></ul> |
| **3 → `v1-beta`** | <ul><li>Ten pushes in a row green, with no retry used (08's "Done when").</li><li>Three nights green.</li><li>`39-panels` with no debt.</li><li>`05` and `16-view` whole.</li><li>`PLAN.md`'s phone playthrough.</li></ul> |

**The journey's debts** (`src/sim/journey.test.ts`) are `it.fails`: a debt that starts to pass fails `check`.
- The paying mission removes its line in the commit that pays it.
- If a line turns green in another mission's merge, two missions overlapped. Look before merging on.

## 4. CI cost

**What each phase adds**, in CI minutes, estimated as each spec's time here less the boot (a shard boots once anyway):

| Phase | New or grown | Added |
|---|---|---|
| 0 | `40-safety` (two pages of its own); the `16-view` split (nothing: no new boot); `12-models` from the gallery | +2.5 |
| 1 | `39-panels` (a phone page of its own, like `07-phone`'s 4.7 min, every panel kind upright and sideways); 16's poses for 05's frozen reactions and 11's sun box | +6.5 |
| 2 | <ul><li>`41-computer` 1.5, `42-busy` 1, `43-album` 1.5, `44-season-road` 1, `45-neighbours` 2, `46-seasons` 2.</li><li>16's winter, rain, snow, car park, café and new places +4.</li><li>`25-button` +1, `05` +1, `03`'s sound measure +1, `23`'s 16 shelves +1.</li></ul> | +17 |
| | **All core tests** | 75 → about 100 min |

**Keeping a push at 15 minutes or less:**
1. **Split `16-view` in four files, not three** (phase 0, 08's commit 4).
   - The house group alone is 11.9 min of tests (rooms 1.6, doorways 2.2, windows 0.7, garden door 0.8, the changed
     house 3.8, carried 0.3, aim 0.2, third person 2.0, wardrobe 0.3), so as one file it would still be the longest
     shard.
   - The four files:

     | File | Tests | Min |
     |---|---|---|
     | `16-view-rooms` | rooms, windows, garden door, carried, aim, wardrobe, third person | 5.9 |
     | `16-view-openings` | doorways, the changed house | 6.0 |
     | `16-view-farm` | the farm, third person and edit, the hedge | 2.2 |
     | `16-view-buildings` | the walk-ins, the supermarket | 4.0 |

   - `src/specs.test.ts` fails two files with one number today, so the same commit must let `16-view-*` share 16.
2. **Shards by measured time, not test count.** `scripts/ci-shards.mjs` deals the files out, longest first, from
   `tests/e2e/times.json`; a new file counts 150 s until measured. A small reporter writes each file's minutes into
   the job's summary, so the times are refreshed by copying.
3. **Eight shards, from phase 0.** The repo is public: a shard costs a minute of setup and no money. With about
   1.5 min of setup and boot each, phase 0's 78 min make about 11 min (08's ≤ 12), phase 2's 100 about 14. Six would
   already pass 15 min in phase 1 (84 / 6 + 1.5).
4. **Docs-only pushes skip CI** (`paths-ignore: ['**/*.md']` on `push`). No test reads a `.md` file (checked), and
   deploy follows CI only, so the site stays on the last green build, which is the same code.
5. **`@full` is the reserve.** If a push still runs over 15 min, a new phone check's second orientation moves to the
   night (the first stays), and a stable test with a page of its own goes `@full`, as 06's boots did.
6. **Flakes are made visible.** The nightly runs with `--fail-on-flaky-tests`, so a flake turns the night red. The
   push keeps its one retry, so a one-off never holds a deploy, and lists every flaky test in the job's summary.

**The flake risks:**
- **Mission 08's three causes of red,** all fixed in phase 0: (a) a hand-kept list (`12-models` then reads the
  gallery; until then, each model commit of 01, 03, 10 and 11 updates the list); (b) clicks on targets the farm
  re-renders (`17`, `19`: `press()` and stable keys); (c) a real-time read across calls (one `evaluate`).
- **`42-busy`:** "Busy till 07:40" comes from the device's clock. Read the words, and the time they were made from, in
  one `evaluate` through a hook that returns both. Never compare against the test's own `Date`.
- **`43`, `44` and `46` follow the calendar.** The nightly starts at 01:17 UTC, and a run can cross midnight, so each
  spec sets `setDailyClock`.
- **`46` and 16's weather poses:** the particles must be frozen, as the farm's hour is, or the frames with the pass on
  and off differ.
- **`43`, `44` and `45` open cards by themselves.** With `VISIT_MOST`, another mission's card can open over a spec on
  the merged branch only: the `37` failure again. Each new switch gets its line in `ready()` and `bootApp` in the same
  commit (CONTRACTS §1.3).
- **`39-panels`** measures every panel at rest.
  - It waits for `document.fonts.ready`, and for each sheet's animations to end (`getAnimations()` empty).
  - Its debt list changes whenever a panel does. Whoever touches a panel runs `39` and updates the list in the same
    commit, as with `05`.
- **`40-safety`'s two tabs:** wait for what the `storage` event brings (the newer farm shown), never for a time, and
  save through the hook rather than waiting on the save interval.

**Writing a spec that cannot flake** (the patterns of `helpers.ts`, `22-xp` and `37`):
1. **Advance and read in one `page.evaluate`.** The expected value is computed in the page from the same snapshot
   (`priceOf`, `clock()`), never across two calls.
2. **Wait on a condition, never a sleep.** Use `expect.poll` or `waitForFunction` on the store or the DOM.
   `waitForTimeout` (over 100 uses today) is never what a test passes on.
3. **Measure things together only once each stands.** Wait for each to be visible, then poll the measurement, as
   `37`'s fix does.
4. **Use `press()`** for anything that re-renders or moves. Call the store directly when the tap is not the subject.
5. **Leave the page as it was.** `ready()` resets every switch, and the spec ends on "afterwards: today's farm".
6. **Set every clock:** the hour (`setHour`, `freezeDay`), the week (`setEventClock`) and the day (`setDailyClock`).
   Use a page of its own (`@boot`) only when time or the animation timeline must move.
7. **Allow for the slowest shard.** Use 15–30 s for whatever waits on frames, and keep each test under 2 min.

## 5. What I verify before each merge

```bash
git merge --no-ff <branch>                    # in the merge checkout, in RUN.md's order
npm run check                                 # 0 failed: about 50 s on a quiet machine
node scripts/affected-specs.mjs HEAD^1        # the specs the merge reaches (until it exists: §1's table)
node scripts/e2e-lock.mjs --all -- npx playwright test --trace off --grep-invert @full <those specs>
# geometry, models or lighting only: BUDGET_MEASURE=1 and the same command for 05 with -g "the walk at"; read its table
git push                                      # then CI green, with no "flaky" in its summary
```

- **Enough evidence:** the agent's report names the commit it ran on and each command with its "N passed" and no
  flaky test (for `05` and `16`, the lines they printed); my own run on the merged tree; after the push, CI green
  with no retry used.
- **Not enough:** green on the branch alone when the merge reaches a hot spec; "passed on retry"; a report without
  its commit.
- **Also check:** the diff stays in the files `RUN.md` gives the branch's owner; a new save field has its line in
  `save.property.test.ts`; a new spec has the number CONTRACTS B12 gave it.

## 6. Scaffold proposal

Nothing here reaches a player: scripts, test data and CI files, with no game file touched. **Not written yet: they
wait for your approval.**

| File | What it does |
|---|---|
| `scripts/e2e-lock.mjs` | <ul><li>Up to 2 slots (`--slots`), as directories made atomically in `/tmp/3d-home-e2e/`, each holding its owner's pid, worktree, port and start time.</li><li>A slot whose process is gone is taken over.</li><li>`--all` takes every slot.</li><li>Refuses a port that is in use.</li><li>Runs the command with `E2E_PORT`, `E2E_FRESH=1` and `PW_CHROMIUM_PATH`, in a process group it ends whole.</li></ul> |
| `scripts/affected-specs.mjs` + `tests/e2e/areas.json` | <ul><li>From `git diff --name-only <ref>`, the specs each changed path reaches (paths → specs, as in §1).</li><li>An unknown or cross-cutting path prints "all: push `wip/<mission>` for CI".</li></ul> |
| `scripts/ci-shards.mjs` + `tests/e2e/times.json` | <ul><li>Shard *k* of *n*: the files dealt out by measured time.</li><li>`--check` fails when a spec file has no time, or when the longest shard would pass 13 min.</li></ul> |
| `tests/e2e/fileTimes.ts` | A Playwright reporter, on CI only: each file's minutes, and the flaky tests by name, in the job's summary |
| `src/ci.test.ts` | <ul><li>Every spec file is in `areas.json` and in `times.json`.</li><li>Every area's paths match a file that exists.</li></ul> |
| `.github/workflows/ci.yml` | <ul><li>Eight shards, from `ci-shards.mjs`.</li><li>`paths-ignore` for `.md` files.</li><li>The reporter.</li><li>`ci-shards --check` in the `check` job.</li></ul> |
| `.github/workflows/full.yml` | `--fail-on-flaky-tests` |
| `vitest.config.ts` | `testTimeout: 20_000` |
| `playwright.config.ts` | `reuseExistingServer: !process.env.CI && !process.env.E2E_FRESH` |
| CLAUDE.md "Before pushing", `tests/README.md` "Run" | The measured times, the lock's command and the ports |

Mission 08's own commit 4 (phase 0), not the scaffold, holds the `16-view` split (in four, with `specs.test.ts`
allowing it), `press()`, `12-models` from the gallery and the actions' new majors. The scaffold lands in phase 0 too:
the lock and the timeout are what let phase 1's agents run side by side.
