# Update v1: how the build is run

How the build agents share one machine without colliding, and how their work flows into
`claude/tender-albattani-7rxfvz` in order. Read with `PLAN.md`, `DECISIONS.md` (every choice taken), `CONTRACTS.md`
(owners, files, save fields, the order of shared files), `JOURNEY.md` (its fixes are folded into the agents below), the
missions, and `CHECKS.md` (testing and CI: specs, gates, shards, flakes). This file holds order, ownership and briefs.

**In one breath.** An agent is one mission's slice whose waits have all landed when it starts, so no agent sits
waiting. Each owns its files and touches a hot file only as §2 says. Every commit is green, so the orchestrator may
merge a prefix of a branch early (`[early]`) when another agent waits on it. Within a phase an agent starts the moment
its waits are merged and a slot is free; a phase starts when the gate before it is green (DECISIONS.md, CHECKS.md).

## Now: what is left (2026-11-19)

23 of the 27 agents are merged (tags `v1/<agent>`); their rows and briefs are out of this file (git history keeps
them). Left: four missions, the beta check, three decisions of the user's, and the open items below, each with who
takes it, so nothing is left without an owner.

**The user's decisions, before the next agent starts**
1. **The long game's pace.** The sim's daily player is at level 32 on day 7, 50 on day 14, 85 on day 30, against
   JOURNEY's 20, 29, 44: the level curve past 30 (`LEVELS`, `src/farm/xp.ts`) slows, or JOURNEY's table changes.
2. **What the beta holds.** 07c and the beta check are needed for any release. 10c (seasons that pay in play), 11c (the
   supermarket's 16 places, the car park, the dealer) and 02c (decoration sets, paint) add content and drawing: each
   is in, or after the beta.
3. **The yard over the farm sideways** (05's debt, 247.1k–254.3k of 250k): paid in P3-budget by update v1's new models
   drawn lighter where it cannot be seen, before 10c, 11c or 02c add to it.

**Left, in order** (one agent at a time; each brief is in §4)

| Step | Size | What it gives | Its specs (and every one `affected-specs.mjs` names) |
|---|---|---|---|
| 07c | L | every word and target read and hit on a phone; 39's debts empty and its checks hard; the top calls one thing at a time | 39, 03, 07, 14, 22, 28; `lab:build` |
| 10c (if in) | L | rain waters the beds, crops in season, the season in the news; never a loss | 46, 34, 33, 25, 05's walk; the sim |
| 11c (if in) | L | the supermarket, car park, dealer | 23, 30, 25, 27, 05's walk, 16-view-buildings; the sim |
| 02c (if in) | M | decoration sets, paint, charm | 33, 05's walk, 27, 12 |
| P3-play | M | the sim to day 30 with every JOURNEY bound held; the first steps on all seven weekdays; the first 30 minutes in the browser | the sim, 37 |
| P3-budget | M | 05 and 16 whole, 26, 27, the night run by hand; every debt paid or listed with its reason | 05, 16, 26, 27 |

**Open items, checked in the code on 2026-11-19, each with who takes it**

- *07c* (the interface): the sale paths play `rewardSound(kind, tier)` with the tier `rewarded()` returns (10 plain
  `farmSound('coins')` left in `src/farm/state/`; GoalsCard and OrdersBoard then pass `sound: true` to `celebrate`);
  `LevelPanel` passes `saving: nextSaving(farm)` to `levelView` (the savings line never shows); *Make room* on the
  silo's and the barn's full row in `StorePanel`; `PanelSheet` stops naming `.good-pop` (GoodPic's bubble carries
  `data-over-sheet` now); the mailbox's picture in `icons.ts` (its compass mark waits on it); the intro's music page
  has *Auto* (`autoMusic()`, as `MusicPlayer` does) — check it is the same page first.
- *A clean-up commit before P3* (the orchestrator, one commit, `npm run check` and the specs it reaches): dead code
  `steadyLook`, `hintShown`/`markHintShown`, the `onReveal` props nothing passes; `farm.ledger`'s `declare module`
  into `FarmData` (`core.ts`); a buyer sent away never turns `'sad'` (`state/buyers.ts`, mission 03) and `core.ts`'s
  mood `'sad'` becomes `'kind'`; `steps.walk.test.ts` says nine steps; the README's shell size (156.7 KB, not about
  120 KB); `quietNeighbours(false)` in the sim's `play.ts`, so `npm run sim` counts the neighbours.
- *P3-budget*: 05's yard debt (above); the house's sun draws in third person and decorating (268 and 263 of 250) by
  `sunAsOne` on the house's static batches.
- *P3-play*: the long game's pace (decision 1); `PACE.first` and JOURNEY's `pull` debts; a farm's first night grows
  something long; 0 of 90 sim visits end with every bed growing and every machine working.
- *After the beta* (nothing breaks without them): a placed thing and a bought piece settle with dust (`Places.tsx`
  reads `reaction()`, `placeDecor` calls `settle`); goods collected at a machine by the button fly to the barn
  (`store()`'s `at` = `machinePoint(id)`); the quilt's and the blanket's pictures read as stripes; the new machines'
  sounds tuned by ear on a phone (`__home.audio.demo()`, the user's); Rina's portrait reads as a man at 56 px.

**How the rest is run** (what this run taught)

- One agent at a time; two only when their files do not meet. No agent waits on another.
- An agent runs `affected-specs.mjs --run` before it hands back (§4); the orchestrator merges it at once, runs the
  merged tip's affected specs once, pushes, and reads CI. A red CI is the next thing done, before anything new.
- No test is run twice for the same commit, and none in parallel with an agent's heavy job.
- A test that is wrong is fixed in the test, with the reason in the commit; a ceiling or debt raised is listed with
  its reason (CLAUDE.md), never silently.

**Before the release (`v1-beta`)**: CI and the night run green on the commit; P3-play and P3-budget done; 39's debts
empty (07c); every item above under 07c, the clean-up and P3 closed; CLAUDE.md's shared paragraphs and the README
current; `lab/audit.json` made again; the user's ✓ on the first 30 minutes on a phone.

## 0. The machine

- **4 cores, 15 GB of memory, 7.8 GB of disk free: at most 2 agents** (8 at once cost more in waiting than it saved). Software WebGL is the bottleneck, so **two heavy
  jobs at most at once** (any Playwright run, art rendering, a lab audit), through a lock: `scripts/v1-heavy.sh`
  (scaffold), until then `flock /tmp/3d-home-v1/heavy-$((SLOT % 2)).lock <command>`. `npm run check` and `npm run sim`
  run freely; a unit test that times out under load is rerun once before it is believed.
- **Slots 1–8.** The orchestrator gives each agent a free slot as it starts. Slot n builds and serves its e2e run on
  `E2E_PORT=420n` (outside CI a server already answering is reused, so two agents on one port test each other's build),
  a dev server on `520n` (art rendering), the lab on `528n`. The orchestrator keeps 4185, 5173 and 5180.
- **No installs.** A worktree links `node_modules` to the main checkout's (a copy is 1.1 GB; `src/deps.test.ts` forbids
  new packages anyway): about 30 MB a worktree. Playwright runs with `--trace off`; `dist/`, `test-results/` go after.
- **Never committed by an agent:** `lab/audit.json` and `lab/check.json` (whole-file reports with a timestamp, made
  again by the orchestrator at each phase's end), `package.json`, `package-lock.json`, and pictures it did not mean to
  change (`render-item-art.mjs` redraws every picture: commit yours, `git checkout -- src/assets` for the rest).

## 1. The dependency graph, as phases

**Scope** names mission changes (`01 c5`) or commits (`08 #3`), CONTRACTS sections (§, A–F rows) and JOURNEY fixes (J).
**Owns**: only this agent edits these. **May touch**: only as written. **Waits for**: merges on the session branch
before it starts (a named commit is that agent's `[early]` prefix). **Dec.**: the decisions it builds (PLAN.md's
numbers, as DECISIONS.md took them; N1–N4 below), each value in its one constant. `state/` is `src/farm/state/`; "§3
lines" is one line in `fresh()`, `load()` and `save.property.test.ts` per named field, in CONTRACTS §3's order.

### Phase 0: the foundation (3 agents), and the early lane (3 agents that touch nothing of phase 0)

Done: P0-split, P0-ci, P0-guard, 07a, 06a, 11a (tags `v1/<agent>`; their rows are in git history).

### Phase 1: the engines (10 agents, 8 at once)

Done: 02a, 07b, 04a, 05a, 03a, 09a, 08b, 06b, 10a, 11b.

### Phase 2: the content (14 agents; 10 done, these 4 left)

Done: 01a, 03b, 04b, 05b, 02b, 10b, 09b, 01b, 06c, 08c.

| Agent | Scope | Owns | May touch, how | Waits for | Dec. |
|---|---|---|---|---|---|
| **11c** · L | 11 c4–c10: the supermarket, 16 places, the café, the car park, the cars (last on the farm's views, D2), the dealer and paints (last) | `src/data/market.ts`, `models/market.ts`, `Market.tsx`, `marketGoods.ts`, `script.ts`'s aisles and café, `park.ts`, `Park.tsx`, `models/park.ts`, `models/car.ts`'s tint, `carPaints.ts`, `Dealer.tsx`, `DealerPanel.tsx`, `models/dealer.ts`, `state/market.ts`, `state/car.ts` | `data.ts`: `LADDERS.places`, `SHOP.cafe`, an `HOURS` row; `people.ts`: the seller; `unlocks.ts`: `paint:`; `MarketPanel.tsx`: the grid; the film's car tint; `05`, `16-view-buildings`, `23`, `30`, `marketFill`: append | 11b, 07b's `MarketPanel`, 01a's PACE, 03a | 11's |
| **02c** · M | 02 c5, F5, c8–c10: sets; a piece's look; the banner (the road's stop); paint; charm | `decor.ts`'s `set`, `tints`, banner row; `models/decor.ts`, `decorModels.ts`, `decorScene.tsx`'s `SOLID`, `DecorShop.tsx`, `EditPanel.tsx`'s *Paint*, `charm.ts`, `state/decor.ts` | `seasonRoad.ts`: the banner's stop; `news/view.ts`: charm; `layout.ts`: `DECOR_FEET`; `05`, `33`: append; §3 lines | 02a, 02b's road | 02's 8, 9 |
| **10c** · L | 10 c5–c9, J2, J11, J12: rain waters the beds; crops in season; the season in the news and as the daily card's line (no card); seasonal decoration; rows in others' tables | `season.ts`'s views, `state/season.ts`, the four seasonal models, `46-seasons` | `state/beds.ts`: rain, `yieldOf`, `seasonal`; `state/away.ts`: `rained`; `AwayPanel`, `panels/Seeds`, `news/view.ts`, `NewsCard`, `DailyCard`: a line or section each; rows in `decor.ts`, `unlocks.ts`, `targets.ts`, `policy.ts`; `05`, `33`: append | 10a, 01a, 02b, 04a | 10's |
| **07c** · L, last | 07 c6–c12: `GoodPic`, the motion pass, the attention budget, sizes and contrast by area, the settings drawer, consistency; `39-panels`' debts empty and hard | as 07a, plus the frames it moves | the top's components: their loops; `SettingsPanel.tsx`: the frame | 04b, 06c, 08c, every new panel (02b, 03b, 09b, 11c) | 17 |

### Phase 3: the beta check (2 agents and the orchestrator)

**P3-play**: the sim to day 30 (`SIM_JOURNEY=daily`, `light`), every `JOURNEY` bound held with no debt left; the first
steps on all seven weekdays; the real first 30 minutes in the browser, upright and sideways. **P3-budget**: `05` and
`16` whole (`@full` too), `26`, `27`, the full run by hand; any D1/D2 excess paid. Both own nothing: a finding goes to
its owner, or into a small branch the orchestrator approves. The orchestrator writes CLAUDE.md's shared paragraphs,
makes `lab/audit.json` again, reviews the whole update and tags `v1-beta`.

### Decisions found here

N1–N4 are taken and built (DECISIONS.md).

## 2. The hot files

**For every hot file:** two additions side by side → keep both, in the order below; a conflict inside a function
another mission owns → stop and report it (file, both commits), never resolve it; a generated file → take the
session's. "Append" means new lines only, at the end of the list, table or file, or at the row's place (a level).

| File | Owner | Rule | Order |
|---|---|---|---|
| `src/farm/FarmUI.tsx` | P0-guard | After P0-guard, only the slot list inside `PanelGuard`. A new panel: one slot line appended, its kind appended to `Panel` and `PANEL_KINDS` (`src/store.ts`) | merge order |
| `src/farm/panels/Seeds.tsx` | 01a | the grid 01a, the fold 04b, the in-season chip 10c | 01a → 04b → 10c |
| `src/styles.css` | 07 | Nobody else adds rules: a new component's CSS is its own file beside it, from the tokens. A token wanted: a one-line request to 07 | 07a → 07b → 07c |
| `src/farm/data.ts` | each table's owner (CONTRACTS) | Rows appended at the end of their table. New fields only by their owner: 01 (`CropDef.water`, `RecipeKey`), 06 (`sounds`, `sound`), 03 (`NAMES`, `PEOPLE_ODDS`), 11 (`LADDERS.places`), 04 (`ORDERS.first`) | keep both |
| `src/farm/state.ts` | P0-split | After the split, a barrel: one `export * from './state/<new>'` line appended per new module. `start()` is 08's | — |
| `src/farm/state/<module>.ts` | CONTRACTS §5's row | A mission edits only its own functions, or appends new ones. In another's function, only E's one-line calls: in the sale paths `rewarded` (05), `sold` (09), `befriend` (03), a sound (06), in that order | E |
| `state/save.ts` `fresh()`, `load()`; `save.property.test.ts` | 08 | One line per field in §3's order; only 08b changes the code round them | §3 |
| `src/farm/unlocks.ts`, `unlockArt.ts` | 01 (the cadence test) | Rows only, at their level | 01a → 01b → others |
| `src/sim/targets.ts`, `pace.test.ts`, `report.ts`, `journey.ts`, `journey.test.ts` | 01 (`PACE`, `JOURNEY`); 08 `sessions.ts` | Rows only, after 01a's PACE commit; a debt leaves `journey.test.ts` only with the agent that pays it | 01a first |
| `src/store.ts` | 07 | `Panel` and `PANEL_KINDS`: one line each, appended | — |
| `HudMode.tsx` (the corner menu) | 07 | Each line at its place in CONTRACTS §4.5; 04b gates the badges | 01a, 02b, 03b, 04b, then 07c |
| `TopStack.tsx` | 04 | 04a's order, then 01a's `busy` slot | 04a → 01a |
| `AwayPanel.tsx` | 04 (`AWAY_ROWS`) | Rows only (C17), at most 4 shown; 07c the frame | 04b → 01a → 10c → 03b |
| `settings.ts`, `SettingsPanel.tsx` | 06 the keys, 07 the drawer | Separate keys; rows appended | 04b → 06b, 06c → 08c → 07c |
| `orders.ts`, the orders board | 01 (sizing) | E | 04a → 01a → 07b → 03b |
| `news/view.ts`, `NewsCard.tsx` | 02 | E | 02b → 10c |
| The cards (`DailyCard`, `LevelCard`, `GoalsCard`, `NewsCard`, `OrdersBoard`, `MachinePanelView`, `XpChip`) | 07b the frames | Content lines by their missions; frame and content are separate hunks | 07b first when both ready |
| `Lighting.tsx`; `sun.ts`; `quarks.ts`, `FarmFx.tsx`; `Furnishings.tsx` | 11a; 11a; 05b; 08c | Separate functions or request kinds (E, C16) | 11a → 10b; 11a → 08c; 05b → 10b; either |
| `src/audio/sounds.ts`, `farmSounds.ts` | 06 | A new sound: a row and a synth appended by the mission that needs it; 06c tunes them | — |
| `art.ts`, `credits.ts`, `CREDITS.md`, `gallery.ts`, `checks.ts`, `lab/boards.ts` | — | Append | keep both |
| `tests/e2e/helpers.ts` | P0-ci (phase 0) | After it, append: a quiet switch is one line in `ready()` and `bootApp`; `fillFarm` one line a mission; new helpers at the end. Only 04b edits `FARM_START` | D2 for `fillFarm` |
| `25-button`'s farms | P0-ci | A new interactable needs nothing; a new save field gets its value on the plenty farm (one line) | — |
| `05-budget` | P0-ci (shape) | New views appended. A debt only by CLAUDE.md's rule, with reason and ceiling; a ceiling is never raised | D2 |
| `16-view-*` | P0-ci (the split) | Poses appended, each in its own `test()` | — |
| `tests/README.md` | everyone | Only your specs' and unit tests' rows; the debts list only the row you add or pay | keep both |
| `CLAUDE.md` | each section's mission | Only your section's sentences. The shared paragraphs (the corner menu, the top column, the cards that open, the run's commands) are the orchestrator's, at each phase's end, from CONTRACTS §4 | — |
| `lab/audit.json`, `lab/check.json` | orchestrator | Never committed by an agent | — |

**Merge order in each phase** (each merge small: what others wait on first, then the smallest ready branch):
- **Phase 0:** P0-ci → P0-guard → the early lane as each is ready → P0-split last. It merges the tip in first, and gets
  one full core CI run on its own branch before it is merged (08: no behaviour may change).
- **Phase 1:** the `[early]` prefixes as they turn green (04a's skip, drain and `ORDERS.first`; 02a's `played`; 07b's
  cards and board), then whole branches: 10a, 09a, 05a, 04a, 03a, 06b, 08b, 02a, 11b, 07b.
- **Phase 2:** 01a's PACE and orders `[early]`, 05b's `celebrate` `[early]`; then the smallest ready, keeping §2's
  orders and D2's on the farm's views (01b → 02c → 03b → 10c → 10b → 11c's cars) when two are ready together. A later
  one ready first merges, and the earlier fits round it: each adds, neither rewrites. 07c is last.

**The budget's ledger** (CONTRACTS D1, D2; the orchestrator writes the measured numbers here at each drawing merge).
The farm's sun pass: 233 draws and 126.8k before 11a, against 250 and 150k; claims 11a/11b +2, 01b +3, 02c +1, 03b +1,
10c +4 = 244, five left. **After 11a (3a09691): 209–216 draws, 131.9k–134.7k** (the bigger box, paid by the farm's static
batches casting as one sun mesh a quarter: about 34 draws and 15k triangles free). The yard's view about 241k of 250k (01b, 02c, 10b, 10c add); the lane's views +25–48k (11c).
Whoever's measure crosses a limit pays in how things are drawn, never with a ceiling.

## 3. What is left, in order

One agent at a time (two only when their files do not meet and the heavy lock has room): 07c, then P3-play and
P3-budget. 10c, 11c and 02c are the user's call before the beta (see Now, above).

## 4. The briefs

**Paste the common part, then the agent's block.** Fill `<ID>` and `<n>` (its slot).

> You are build agent **<ID>** of update v1 (3D HOME), in your own git worktree, slot **<n>**. Your row in
> `update-v1/RUN.md` §1 is part of this brief: **Owns** (only you edit these), **May touch** (only as written there),
> **Waits for** (already merged), **Dec.** (build each as `update-v1/DECISIONS.md` and RUN.md N1–N4 take it, its value
> in its one constant). Read `CLAUDE.md`, RUN.md §0–§2 and §5, `update-v1/CHECKS.md`, and what your block names.
> **Setup:** `ln -s /home/user/3D-Home-Web/node_modules node_modules` and `mkdir -p /tmp/3d-home-v1`; never
> `npm install` or `npm ci`. Your ports: `E2E_PORT=420<n>`, a dev server on `520<n>` (for `render-item-art.mjs
> http://localhost:520<n>/`), the lab on `528<n>`.
> **Each commit** is green: `npm run check`, then only your block's specs, each through the heavy lock:
> `flock /tmp/3d-home-v1/heavy-$((<n> % 2)).lock env E2E_PORT=420<n> PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx
> playwright test --trace off --grep-invert @full <file>` (`05` and `16` only if you draw: 05's walk is `-g "the walk
> at"` with `BUDGET_MEASURE=1`, 16 only your group with `-g`); delete `dist/` and `test-results/` after. `npm run sim`
> after any number you change. A rule or a save change gets its unit test beside it; a save field its §3 lines.
> **Before you hand back**, on your branch merged with the tip: `node scripts/affected-specs.mjs --run` (every spec your
> change reaches, by `tests/e2e/areas.json`), all green, and its list and results in your report. A new kind, good,
> machine or field reaches specs your own block does not name (the busy card, the edit mode's places, the panels'
> counts, the phone mix): that is what this run is for. A spec it misses that your change broke is a row to add to
> `areas.json` in the same branch.
> **Ownership:** a change you need outside your row: leave it, and put a one-line request in your report (file, what,
> why). An improvement inside your own files may be folded in; name it in your report.
> **Merging:** merge (never rebase) `claude/tender-albattani-7rxfvz` into your branch before your first commit, before
> each commit that touches a hot file (§2), whenever the orchestrator says a wait or a hot file landed, and last, right
> before you hand back; `npm run check` after each, your specs again after the last. Conflicts: §2's rules. Never commit
> `lab/audit.json`, `lab/check.json`, `package.json`, `package-lock.json`, pictures not yours, `.only`, or a raised
> ceiling. Mark a commit `[early]` in its subject when your row says others wait on it. End every commit message with
> the two attribution lines the orchestrator gives.
> **Report**, in this order: branch and last commit; the commits, one line each; the specs run, each with its result
> and minutes; if you draw, your `BUDGET_MEASURE` rows (view, size, pass, triangles, draws) against your claim (§2); if
> you changed a number, the sim's rows; each decision's constant and file; requests to other owners; improvements
> folded in; what is left and why; stills at 390×844 and 844×390 of anything a player sees, by full path.

**The blocks** (Goal · Read · Never · Specs, after `npm run check`; a spec by its number, `lab:build` is `npm run
lab:build`). Mission sections are `c` changes, `§` its own sections:

- **11c.** Goal: a supermarket with more to do, a car park that grows, a dealer for paints. Read: 11 c4–c10; CONTRACTS
  §1.16, §3, C12, D2. Specs: 23, 30, 25, 27, 05's walk, 16-view-buildings; the sim (16 places).
- **02c.** Goal: decoration that reads as sets, can be painted, and is noticed. Read: 02 c5, F5, c8–c10; CONTRACTS §3,
  D1. Never: the road's rules. Specs: 33, 05's walk, 27, 12.
- **10c.** Goal: seasons that pay in play and looks, never as a loss. Read: 10 c5–c9; JOURNEY 2, 11, 12; CONTRACTS
  §1.15, §4.8, C8. Never: the renderer. Specs: 46, 34, 33, 25, 05's walk; the sim from each season.
- **07c.** Goal: everything read and hit on a phone; the top asks for one thing at a time. Read: 07 c6–c12; CONTRACTS
  §1.8, §4. Never: a panel's content. Specs: 39 (hard), 03, 07, 14, 22, 28; lab:build.
- **P3-play, P3-budget.** As phase 3 says. Read: PLAN "Done when", JOURNEY, CHECKS.md. Never: an owner's file without
  the orchestrator's yes.

## 5. How an agent's work is accepted

Before merging, the orchestrator checks (scripted by `v1-merge.sh` once approved):
1. The report is whole, in §4's order; the session tip is merged in, or merges in with no conflict.
2. Every changed file is in the row's Owns, or in May touch in the way written (hot files: §2).
3. Nothing on the never-commit list; no new package; no `.only`; no ceiling raised, no debt added without its reason
   and its `tests/README.md` row; no expectation weakened without the reason in the report.
4. `npm run check` green on the merge; the specs `affected-specs.mjs` names for the merge pass once, on the merged tip,
   before the push (one run for every merge waiting to go up, never one per merge); `npm run sim` holds `PACE` if a number
   moved.
5. The project's rules: a unit test beside each rule and save change; a save field with its §3 lines and its conversion
   test; a buyable with its `UNLOCKS` row; a panel in `PANEL_KINDS`; a model in the gallery and the checks; a picture
   credited; a spec number by B12; its rows in `tests/README.md` and CLAUDE.md.
6. A drawing change within its claim (§2's ledger) and its `16` group equal; each decision in its one constant; each
   `[early]` commit green on its own.

**Sent back** (to the same agent, or a new one on its branch, with the list) when any of these fails, when it resolved
a conflict inside another mission's function, or when a request it raised must land before its work can.

## 6. If a merged phase turns CI red

- **Every merge is `--no-ff` and tagged `v1/<agent>`; each phase's start is tagged `v1-phase<N>`.** No force-push and no
  reset of the session branch: the site stays on the last green commit, since deploy waits for CI. Nothing merges on a
  red tip but the fix or the revert, so the search stays short; agents keep working.
- **Find the merge.** CI cancels a run when a newer push comes, so one red run may hold several merges. Not a flake by
  CHECKS.md's rule? Run the failing test at each first-parent merge since the last green commit, under the lock: the
  first red one is the cause.
- **Revert it** (`git revert -m 1 <merge>`), push, and send its agent the failing test. To land it again, revert the
  revert first, then merge the fix: git counts a reverted branch as merged.
- **A save field that reached players is never reverted:** `load()` drops unknown keys, so the next save would wipe
  their data (days played, the ledger). Revert the feature, keep the field's `fresh()`, `load()` and save lines, or fix
  forward.
- **A tangled phase:** revert its merges newest first down to `v1-phase<N>`, fix on the branches, merge again in §2's
  order. A red night (`full.yml`) is handled the same way from its commit, before the next phase starts.

## Tools (built)

- `scripts/v1-merge.sh <branch> [<agent>]`: merge `--no-ff`, `npm run check`, `v1-scope.mjs` against `owners.json`.
- `scripts/v1-scope.mjs`: a branch's files against its row in `owners.json`.
- `scripts/affected-specs.mjs [<ref>] [--files …] [--run]`: the e2e specs a change reaches (`tests/e2e/areas.json`).
- The heavy lock: `flock <scratchpad>/locks/heavy-<slot % 2>.lock <command>`.
