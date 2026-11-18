# Update v1: how the build is run

How the build agents share one machine without colliding, and how their work flows into
`claude/tender-albattani-7rxfvz` in order. Read with `PLAN.md`, `DECISIONS.md` (every choice taken), `CONTRACTS.md`
(owners, files, save fields, the order of shared files), `JOURNEY.md` (its fixes are folded into the agents below), the
missions, and `CHECKS.md` (testing and CI: specs, gates, shards, flakes). This file holds order, ownership and briefs.

**In one breath.** An agent is one mission's slice whose waits have all landed when it starts, so no agent sits
waiting. Each owns its files and touches a hot file only as §2 says. Every commit is green, so the orchestrator may
merge a prefix of a branch early (`[early]`) when another agent waits on it. Within a phase an agent starts the moment
its waits are merged and a slot is free; a phase starts when the gate before it is green (DECISIONS.md, CHECKS.md).

## 0. The machine

- **4 cores, 15 GB of memory, 7.8 GB of disk free: at most 8 agents.** Software WebGL is the bottleneck, so **two heavy
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

| Agent | Scope | Owns | May touch, how | Waits for | Dec. |
|---|---|---|---|---|---|
| **P0-split** · L | 08 #1–3, §1.1–1.4, §5, A8, A13, C11: `time.ts` at the 8 countdowns and 4 durations; `saved.ts` in the 10 sanitizers (`seconds`, `cycle`); `state.ts` split as §5's "Holds today", ending in `start()`; `core.ts` with both clocks; `rewards.ts` holding today's `give`; `quiet.ts` behind the events', steps' and unlocks' switches | `src/farm/state.ts`, `src/farm/state/**`, the 12 formatter sites, the sanitizers' reader lines | `17-stores-orders`: the board's text through `clock()` (one line) | — | 19 |
| **P0-ci** · M | 08 #4, B12, B13: `16-view` in three files by group (`16-view-house`, `-farm`, `-buildings`), with `src/specs.test.ts` taught that one spec may come in parts (today three `16-` files fail it); `12-models` from the gallery, its ids test in `checks.test.ts`; `press()`; real-time reads in one `evaluate`; `walkInPoses` into `helpers.ts`; actions on their Node 24 majors; shards rebalanced; CHECKS.md's approved changes | `tests/e2e/helpers.ts`, `05`, `12`, `16*`, `17`, `19`, the specs with real-time reads (named in its report), `.github/workflows/**`, `playwright.config.ts`, `src/specs.test.ts`, `src/models/checks.test.ts` | `tests/README.md`: the Run section and its specs' rows | CHECKS.md (its parts only) | 19 |
| **P0-guard** · M | 08 #6, §1.5, §1.6's runtime, B16: `PanelGuard` round each panel slot, `Hud`, `HudMode`; `onUncaughtError` into diagnostics; FarmUI's own panels (Seeds, Bed, Build, Queue) moved unchanged to `src/farm/panels/`, so `FarmUI.tsx` is only the slot list; `registerCard`, `CardWatcher`, `cardShowing`; the daily gift, welcome back and `Unlocked` on the queue; `AUTO_CARDS` imports `CARD_ORDER`; spec `40-safety` | `src/ui/PanelGuard.tsx`, `cardQueue.ts`, `useGameFree.ts`, `src/farm/FarmUI.tsx`, `src/farm/panels/**`, `src/main.tsx`, `src/App.tsx`, `40-safety` | `DailyPanel.tsx`, `AwayPanel.tsx`, `Unlocked.tsx`: how each opens; `src/sim/journey.ts`: the `AUTO_CARDS` line | — | 19, 20 (no `counts` card) |
| **07a** · M–L, early | 07 #1–2, F3, §1.7, §1.8's cores: `still.ts` whole (hook, `data-motion`, `MotionConfig`), the 14 `matchMedia` and 20 `useReducedMotion` readers and the 46 CSS blocks on it, with its guard test; `PanelSheet` F1/F2 with `[data-over-sheet]`; `nope`/`did`; `useCalling`; `readable.ts` and `39-panels` listing debts; `PANEL_KINDS` | `src/ui/still.ts`, `PanelSheet.tsx`, `calls.ts`, `motion.tsx`, `src/styles.css`, `src/store.ts`, `tests/e2e/readable.ts`, `39-panels` | each reduced-motion reader: that line; each CSS file: the media query's selector only | — (N1) | 17 |
| **06a** · M, early | 06 #3–5: `play(engine)`, the fake, `SOUNDS` read with variation, `sound.ts` split; the mixer and three volumes; one key | `src/audio/**`, `src/lib/device.ts` | `settings.ts`: the volume keys; `SettingsPanel.tsx`, `Intro.tsx`: the volume rows; `SoundDirector`, `StoryFilm`, `MusicPlayer`: their bus lines; `03-settings`: append | — (N1) | 16 |
| **11a** · M, early | 11 c1 and C: the farm's sun box (`inSunShadow` by map; the box and map size in `Lighting.tsx`); `castAsOne` | `src/data/sunBox.ts`, `sunCheck.ts`, `src/data/buildings.test.ts`, `sun.ts`'s `castAsOne` | `src/data/layout.ts`: `inSunShadow`; `Lighting.tsx`: the box; `27`: its sun bounds | — (N1) | 11's 2 |

### Phase 1: the engines (10 agents, 8 at once)

| Agent | Scope | Owns | May touch, how | Waits for | Dec. |
|---|---|---|---|---|---|
| **02a** · L | 02 F1–F4, c1's `played`, §1.9, §1.10, B5, B7, B11: `prize.ts`'s callers (`gifts.ts` re-exports); `give(prizes, kind, at)` for four kinds; `calendar.ts`'s callers; `farm.played` and `markPlayed` `[early]`; `measure.ts`, `GOALS` on `count`, `goals.fruit`; `road.ts` and a shared `Road` | `prize.ts`, `gifts.ts`, `calendar.ts`, `measure.ts`, `road.ts`, `goals.ts`, `src/ui/Road.tsx`, `state/rewards.ts`'s `give`, `state/daily.ts`'s `markPlayed` | `daily.ts`, `events.ts`: re-exports; `DailyCard.tsx`: the road's drawing; §3 lines (`played`, `goals.fruit`) | P0-split | 8 |
| **07b** · L | 07 c3–c5: `Shell` as a card on `PanelSheet` (22 kinds); the level, goals, daily and news cards off `SwipeSheet`, a commit each `[early]`; the orders board `[early]` and the machine panel on `PanelSheet` | `src/ui/Shell.tsx`, `SwipeSheet.tsx` (deleted), the frames (head, sheet, frame CSS) of those cards, `OrdersBoard`, `MachinePanelView`, `MarketPanel` | `helpers.ts`: append `closePanel()`; their `lab/boards`: keep building | 07a, P0-guard, P0-ci (not P0-split) | 17 |
| **04a** · M | 04 #1–5: the kind skip (`'pleading'` gone) `[early]`; the top column's order; turns, `Target`/`walkTarget`, the follower test; the festival drain `[early]`; `ORDERS.first` `[early]` | `firstSteps.ts`, `FirstSteps.tsx/.css`, `walkTargets.ts`, `FarmerFace.tsx`'s moods, `TopStack.tsx`, `state/steps.ts`, `steps.walk.test.ts` | `state/beds.ts`: the drain line; `data.ts`: `ORDERS.first`; `state/orders.ts`: slot 0; `art.ts`, credits, `render-farmer-faces.mjs`: the pleading face out | P0-split | 13 |
| **05a** · M | 05 #1, #6, §1.11, B7: `rewarded()`, `rewardCounts()`, called once in every payout; `react.ts`; `Parts.at` with a `Vector3` | `src/lib/tier.ts`, `worth.ts`, `state/rewards.ts`'s `rewarded`, `src/fx/react.ts`, `src/fx/reward.ts`'s `SHOW`, `parts.ts`'s `at` | each payout: one `rewarded()` line (E); `give`: its one call, if 02a landed first | P0-split | 15 |
| **03a** · M | 03 c1–c3, c5, §1.13, B8, B9: `PEOPLE` wired (looks and voices as today); `Portrait`; portraits rendered; `farm.friends`, `befriend`; one `Line`, the guilt lines gone, the kind-words test | `src/data/people.ts`, `src/ui/Portrait.tsx`, `src/farm/people/friends.ts`, `src/talk/**`, `src/assets/people/`, `state/neighbours.ts` | `FarmerFace.tsx`: re-export; `film/cast.ts`, `voice.ts`, `models/tractor.ts`: looks and voices from `PEOPLE`; sale and send: one `befriend` line; §3 lines (`friends`) | P0-split; 04a #1 for `FarmerFace` | 11, 12 |
| **09a** · S–M | 09 c1, c2, c4, §1.14: `priceOf` on `priceAt`, `priceFor` on `BUYER_OFFERS`, the ledger saved and `sold()` in the five paths, `APPS` | `prices.ts`, `ledger.ts`, `state/ledger.ts`, `src/farm/computer/**` | each sale: one `sold()` line; `state/buyers.ts`: `priceFor`; §3 lines (`ledger`) | P0-split | 09's |
| **08b** · M | 08 #5, #7a, #7b, #8, #9: the shell's step 1 (`SHELL_BYTES = 250_000`); a broken slot kept (`:broken`, `:prev`) and shown; a full storage told once; one farm, one tab; one restart mid-game | `src/ui/GameLayer.tsx`, `vite.config.ts`'s `SHELL_BYTES`, `state/save.ts` (bodies, slots), `SavesPanel.tsx`, `src/lib/startup.ts` | `App.tsx`: the lazy imports, once; `40-safety`, `11-startup`: append | P0-split, P0-guard | 08's 4 |
| **06b** · M | 06 #2, #6–9: the *Less motion* setting; a sound of its own per action (`MACHINES[].sounds`, `sound: 'pick'`); streaks; the phone mix; the haptics map with `sale+` | as 06a | `settings.ts`: `motion`; `data.ts`: the `sounds`, `sound` fields; 06 c5's call sites: one line each; `Garden.tsx`: the beds' count | 06a, 07a, P0-split | 16 |
| **10a** · S | 10 c1, §1.15: `state/season.ts`, the save's `season`, quiet in tests | `season.ts`, `weather.ts`, `state/season.ts` | §3 lines (`season`); `helpers.ts`: one line in `ready()` and `bootApp` | 02a's `played` | 10's |
| **11b** · M | 11 c2, c3, c3b: the lot as rows, its shells as one sun mesh, 05's walk-in views from the rows; the bigger estate office, its house model and map, the meadows' tags | `src/data/lot.ts`, `src/data/estate.ts`, `models/estate.ts`, `Estate.tsx`, `landGeometry.ts`, `scene/WalkIn.tsx`, `src/farm/layout.ts`'s lot | `src/data/market.ts`, `models/market.ts`: rows; `script.ts`: the agent's way; `05`, `16-view-buildings`, `30`: append | 11a, P0-ci | 11's |

### Phase 2: the content (14 agents, 8 at once)

| Agent | Scope | Owns | May touch, how | Waits for | Dec. |
|---|---|---|---|---|---|
| **01a** · L | 01 c1–c6, c9, c10, J1, J5, J7's `nextSaving`, J9: `economy.ts`; `PACE` and `JOURNEY` on the runner `[early]`; `AWAY_MOST` 24 h, `water`; `readyAt` at prompts and packets; orders by level with a quick slot `[early]`; long crops (cotton 7, potato 12, paid in price) and *Make room*; the busy card | `economy.ts`, `appointments.ts`, `src/sim/**` but `sessions.ts`, `CROPS` rows, `models/crops.ts`, `models/plants.ts`, `makeOrder`, `state/stores.ts`'s *Make room*, `state/away.ts`'s `AWAY_MOST`, `panels/Seeds.tsx`, `levelView.ts`, `LevelCard.tsx`'s line, `42-busy` | `TopStack.tsx`: the `busy` slot; `HudMode.tsx`: *Next ready*; `AwayPanel.tsx`: rows (C17); `unlocks.ts`: rows; `journey.test.ts`: its debts out | 04a's drain and `ORDERS.first`, 05a | 1–3, 6, 7, N4 |
| **03b** · L | 03 c4, c6–c9, J6: neighbours at the gate; requests; letters and the mailbox; chapters (act 1 at 5, 8, 12, 17, 23; act 2 at 27–45; one a visit); hearts; birthday letters that wait 7 days | `src/farm/people/**`, `state/neighbours.ts`, `Mailbox.tsx`, `LetterCard.tsx`, `NeighboursCard.tsx`, the mailbox model, `Visitors.tsx`'s heart, `45-neighbours` | `orders.ts`: `from`, `chapter`, `makeRequest`; the board: content; `state/buyers.ts`: `who`; `data.ts`: `NAMES`, `PEOPLE_ODDS`; rows in `unlocks.ts`, `HudMode.tsx`, `AwayPanel.tsx`, gallery, checks; §3 lines; `helpers.ts`: `neighbours` quiet; `05`, `16-view-farm`: append | 03a, 02a's `give`, 07b's board, 01a's orders | 11, 12 |
| **04b** · L | 04 #6–14, J1 (the last step plants the longest crop open), J3, J7 (`NEXT_SOURCES`), J11 (`AWAY_ROWS`): *Show me*, `REVEAL`, `FARM_START`, the controls taught once, *Next* on the welcome back, the two-way seed choice | `reveal.ts`, `nextUp.ts`, `AwayPanel.tsx`, `maps.ts`'s `FARM_START`, `GuideMarker.tsx`, `Hud.tsx`'s `FirstHint`, `TouchControls.tsx`, `stick.ts`, `GoodPic.tsx`'s badge | `settings.ts`: `learnt`; `TopDash`, `XpChip`, `HudMode`, `Garden`, `Compass`: the `shows()` gates; `OrdersBoard.tsx`: the foot; `goals.ts`: `go`; `panels/Seeds.tsx`: the fold; `helpers.ts`: `FARM_START`, `learnt` | 04a, 07a, 02a, 05a; 01a's crops (J1's row) | 14 |
| **05b** · L | 05 #2–5, #7–10: payouts in the world and in cards through `celebrate` `[early]`; `popInto` and the gauge hold; goods fly to their store; plants, producers and pieces react; furniture last; `PACE.rewards` | `src/fx/**` but `quarks.ts`, `src/ui/fly.ts`, `Plants.tsx`, `Herd.tsx`'s pose, `src/fx/reward.css` | the cards: their `burst` and sound lines; `TopDash.tsx`: `StoreGauge`; `edit.ts`, `decorScene.tsx`, `Garden.tsx`: settle; `FarmFx.tsx`: its request; `state/stores.ts`: `store(id, n, at)`; `targets.ts`: a row; `16-view-farm`: the frozen pose | 05a, 07b's cards, 01a's PACE (the row) | 15 |
| **02b** · L | 02 c1–c4, c6, c7, J4, J10: the week waits (N2); odds; kind words; "almost" and *Pick fruit*; the album with `outfit.owned`; the season road (`SEASON_ROAD`, 10 stops, XP, "This season"); one box a level to 4 | `daily.ts`, the bodies of `DailyCard`, `NewsCard`, `GoalsCard`; `album.ts`, `AlbumCard`, `AlbumPanel`, `seasonRoad.ts`, `state/seasonRoad.ts`, `state/album.ts`, `outfit.ts`, `news/view.ts`, `goalsView.ts`, `43-album`, `44-season-road` | `HudMode.tsx`: *Album*; a slot (§2); §3 lines; `targets.ts`: `road`; `helpers.ts`: `road` quiet; `gifts.ts`: the box count | 02a, 10a, 07b's cards, 01a's PACE (the road) | 8–10, N2 |
| **10b** · L | 10 F4, c2–c4: the season chunk and `shelters()`; the light; the land's look; rain, snow and the rainbow by three.quarks | `weatherLook.ts`, `material.ts`'s season chunk, `models/trees.ts`'s `foliage`, `Land.tsx`, `Ground.tsx`, `Exterior.tsx`, `House.tsx`'s roof, `world.ts`'s `shelters`, `quarks.ts`'s `weatherFx`, `profile.ts`'s `weather` | `Lighting.tsx`: `DayLight`; `FarmFx.tsx`: the weather feed; `Maps.tsx`; `05`, `16-view-*`, `26`: winter, rain and snow poses | 10a, 11a | 10's |
| **11c** · L | 11 c4–c10: the supermarket, 16 places, the café, the car park, the cars (last on the farm's views, D2), the dealer and paints (last) | `src/data/market.ts`, `models/market.ts`, `Market.tsx`, `marketGoods.ts`, `script.ts`'s aisles and café, `park.ts`, `Park.tsx`, `models/park.ts`, `models/car.ts`'s tint, `carPaints.ts`, `Dealer.tsx`, `DealerPanel.tsx`, `models/dealer.ts`, `state/market.ts`, `state/car.ts` | `data.ts`: `LADDERS.places`, `SHOP.cafe`, an `HOURS` row; `people.ts`: the seller; `unlocks.ts`: `paint:`; `MarketPanel.tsx`: the grid; the film's car tint; `05`, `16-view-buildings`, `23`, `30`, `marketFill`: append | 11b, 07b's `MarketPanel`, 01a's PACE, 03a | 11's |
| **09b** · L | 09 c3, c5–c8: the mood; the computer, its desktop, Market, Planner, Sales book; `41-computer`; CLAUDE.md's "The house's computer" | `mood.ts`, `src/home/Computer.tsx`, `src/farm/computer/**`, `catalogue.ts`'s row, `Furnishings.tsx`'s case for it, `41-computer` | `state/day.ts`: the `priceEvents` line (B10); `helpers.ts`: `mood` quiet, a computer on the plenty farm; a slot; `Experience.tsx`: mount | 09a, 07a, 01a's PACE (the mood) | 09's, N3 |
| **01b** · L | 01 c7, c8, J8: wave 1 (recipes, North beds, herd steps); wave 2 (dairy, beehive, jam kettle, a building a commit with its `sounds`; Meadow and Far beds); a row every 2 levels from 31 to 45 | `data.ts`'s `RECIPES`, `MACHINES` rows, `EXPANSIONS`, `BEDS`, herd rows; `models/buildings.ts`; `Workshop.tsx`; `unlocks.ts`'s cadence | `layout.ts`: `PLACES`; `decor.ts`: the hive's `store`; gallery, checks, `sounds.ts`: rows; `fillFarm`: a line; `05`, `16-view-farm`: append; §3 lines | 01a's PACE, 06b, 11a | 4, 5 |
| **02c** · M | 02 c5, F5, c8–c10: sets; a piece's look; the banner (the road's stop); paint; charm | `decor.ts`'s `set`, `tints`, banner row; `models/decor.ts`, `decorModels.ts`, `decorScene.tsx`'s `SOLID`, `DecorShop.tsx`, `EditPanel.tsx`'s *Paint*, `charm.ts`, `state/decor.ts` | `seasonRoad.ts`: the banner's stop; `news/view.ts`: charm; `layout.ts`: `DECOR_FEET`; `05`, `33`: append; §3 lines | 02a, 02b's road | 02's 8, 9 |
| **10c** · L | 10 c5–c9, J2, J11, J12: rain waters the beds; crops in season; the season in the news and as the daily card's line (no card); seasonal decoration; rows in others' tables | `season.ts`'s views, `state/season.ts`, the four seasonal models, `46-seasons` | `state/beds.ts`: rain, `yieldOf`, `seasonal`; `state/away.ts`: `rained`; `AwayPanel`, `panels/Seeds`, `news/view.ts`, `NewsCard`, `DailyCard`: a line or section each; rows in `decor.ts`, `unlocks.ts`, `targets.ts`, `policy.ts`; `05`, `33`: append | 10a, 01a, 02b, 04a | 10's |
| **06c** · M | 06 #10–12: tier stings, rattles, coin landings, the step back; music layers and birds; *Auto*; every sound row the others added, tuned in key and in the phone mix | `src/audio/**`, `MusicPlayer.tsx`, `SoundDirector.tsx` | `DailyCard`, `LevelCard`: `onShake`; `DailyPanel`, `LevelPanel`; `fx/coins.ts`: `landed(i)`; `settings.ts`: `musicTrack` | 05b's `celebrate`, 06b | 16 |
| **08c** · M | 08 #10–12: far copies and one sun caster a piece for the furniture; `health.ts`; the shell's step 2 (decision 20 is no: no counts) | `sun.ts`'s `farFromCopies`, `Furnishings.tsx`'s `GlbProp`, `src/sim/health.ts`, `sessions.ts` | `05`: its two shadow debts; `27`, `16-view-house`; `ROOM_WEIGHT`; `Intro.tsx`: the lazy tab | 08b, 11a | 18, 20 |
| **07c** · L, last | 07 c6–c12: `GoodPic`, the motion pass, the attention budget, sizes and contrast by area, the settings drawer, consistency; `39-panels`' debts empty and hard | as 07a, plus the frames it moves | the top's components: their loops; `SettingsPanel.tsx`: the frame | 04b, 06c, 08c, every new panel (02b, 03b, 09b, 11c) | 17 |

### Phase 3: the beta check (2 agents and the orchestrator)

**P3-play**: the sim to day 30 (`SIM_JOURNEY=daily`, `light`), every `JOURNEY` bound held with no debt left; the first
steps on all seven weekdays; the real first 30 minutes in the browser, upright and sideways. **P3-budget**: `05` and
`16` whole (`@full` too), `26`, `27`, the full run by hand; any D1/D2 excess paid. Both own nothing: a finding goes to
its owner, or into a small branch the orchestrator approves. The orchestrator writes CLAUDE.md's shared paragraphs,
makes `lab/audit.json` again, reviews the whole update and tags `v1-beta`.

### Decisions found here (the twenty are taken in DECISIONS.md)

- **N1. The early lane** (needed now). 07a, 06a, 11a, and 07b once its waits are in, touch nothing of phase 0 (no
  `state.ts`, `FarmUI.tsx`, `helpers.ts`, `16`): starting them early keeps decision 19's reason and six slots busy.
  **Recommended: yes**; if not, they start first in phase 1.
- **N2. The daily week** (02b). Decision 8 says "counts gifts claimed"; CONTRACTS' [review] and JOURNEY fix 4, also
  taken, say "the season's week". Both wait through any absence. **Default: the season's week** (`dailyDay()` on days
  played), keeping 8's welcome-back gift and days played; an unclaimed day's prize joins the next claim.
- **N3. 09's lab board** (09b). 09 asks for a designer's board, but CLAUDE.md starts a designer only when the user asks
  in so many words. **Default: no board**, built in the game's look.
- **N4. The busy card and the cap** (01a). Decision 6 says "inside the card queue's cap"; CONTRACTS makes it a top slot.
  **Default: CONTRACTS**: it shows only with no card up, and never counts toward `VISIT_MOST`.

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
The farm's sun pass: 233 draws and 126.8k today, against 250 and 150k; claims 11a/11b +2, 01b +3, 02c +1, 03b +1,
10c +4 = 244, five left. The yard's view about 241k of 250k (01b, 02c, 10b, 10c add); the lane's views +25–48k (11c).
Whoever's measure crosses a limit pays in how things are drawn, never with a ceiling.

## 3. The size of each phase

| Phase | Agents, in start order (biggest and most waited on first) | At once | Starts |
|---|---|---|---|
| 0 | P0-split, 07a, P0-guard, P0-ci, 06a, 11a | 6 | now (the early lane with N1) |
| 1 | 02a, 07b, 04a, 05a, 03a, 08b, 06b, 09a; then 10a, 11b as slots free | 8 | phase 0's gate (07b earlier with N1) |
| 2 | 01a, 03b, 04b, 05b, 02b, 10b, 11c, 09b; then 01b, 02c, 10c, 06c, 08c; 07c last | 8 | phase 1's gate |
| 3 | P3-play, P3-budget | 2 | phase 2's gate |

An agent that hands back frees its slot for the next in order at once; heavy jobs still run two at a time (§0).

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

- **P0-split.** Goal: one clock, one set of save readers, `state.ts` split, no import outside changed and no behaviour.
  Read: 08 §1, §3, c1–c3; CONTRACTS §1.1–1.4, §5, A8, A13, C11. Never: `src/ui/**`; tests but 17's line (FarmUI's
  `seconds` line lives in P0-guard's Seeds panel by then). Specs: 17, 20, 34, 35, 37; then one full core CI run.
- **P0-ci.** Goal: a push waits 15 minutes at most, with no known flake. Read: 08 §1, c4; CONTRACTS B12, B13; CHECKS.md.
  Never: `src/**` but its two tests. Specs: 12, 16's core groups, 17, 19, 05's walk; `--list` for each shard.
- **P0-guard.** Goal: a panel that throws closes and the game plays on; self-opening cards come through one queue, two
  a visit. Read: 08 c6; CONTRACTS §1.5, §1.6, §4.2, B16; JOURNEY 2. Never: `state/`, a look. Specs: 40, 20, 35, 22.
- **07a.** Goal: one less-motion reader, one sheet, one call at a time, a spec of what cannot be read. Read: 07
  Foundation, c1–c2; 06 Foundation 5; CONTRACTS §1.7, §1.8, A4, B2, B3. Never: a frame. Specs: 39, 03, 22; lab:build.
- **06a.** Goal: one table of sounds in one key, through one mixer with three volumes. Read: 06 Foundation 1–4, c2–c4;
  CONTRACTS §1.12, A3. Never: CSS, `still.ts`, `data.ts`. Specs: 03.
- **11a.** Goal: room in the farm's sun box at today's sharpness; one sun mesh a kind. Read: 11 Foundation A, C, c1;
  CONTRACTS §1.16, D1. Never: `helpers.ts`, `05`, `16`. Specs: 05's walk, 27, 16's house and farm groups.
- **02a.** Goal: one door for every prize, one calendar with days played, goals as data, one road engine. Read: 02
  Foundation, c1, c4; CONTRACTS §1.9, §1.10, §3, B5, B7, B11. Never: the week's rules, a frame. Specs: 35, 21, 37.
- **07b.** Goal: every panel on one sheet, opening, swiping and closing alike. Read: 07 Foundation, c3–c5; CONTRACTS
  §1.8, C12. Never: a card's content. Specs, by commit as 07 lists: 08, 17, 20–23, 25, 30, 32–36, 38, 39; lab:build.
- **04a.** Goal: no first step is a dead end, on any day. Read: 04 §2 (1–2), c1–c3, c7, c10; CONTRACTS A10, B9, E.
  Never: `REVEAL`, the HUD. Specs: 37, 17; the sim.
- **05a.** Goal: every payout counted once with its tier; reactions ready. Read: 05 Foundation A, C, c1, c6; CONTRACTS
  §1.11, B6, B7, C2–C4. Never: the cards, `PACE`. Specs: 25; the sim.
- **03a.** Goal: one table of people, anyone's portrait, friendship that only grows. Read: 03 Foundation, c1–c3, c5;
  CONTRACTS §1.13, §3, B8, B9. Never: the board, the gate's line. Specs: 37, 29, 12; portraits rendered under the lock.
- **09a.** Goal: every price with named parts, every sale in the book. Read: 09 F1–F3, F5, c1, c2, c4; CONTRACTS §1.14,
  §3, B10, C11. Never: the mood. Specs: 17, 23, 34; the sim.
- **08b.** Goal: the start screen sooner; no farm wiped by its own save or a second tab. Read: 08 c5, c7–c9;
  CONTRACTS §3 ("08's keys"). Never: a save field's line. Specs: 11, 40, 01, 14, 22; `npm run build`.
- **06b.** Goal: a sound of its own for each action, streaks that climb, a touch that means one thing. Read: 06 c1, c5,
  c6, c8, c9; CONTRACTS §1.12, C15. Never: CSS. Specs: 03 (with the phone mix), 32, 33.
- **10a.** Goal: the season and weather in the farm, spring and clear in every test. Read: 10 F1–F3, c1; CONTRACTS
  §1.15, §3, C7. Never: the look. Specs: 34, 35; the sim.
- **11b.** Goal: the lot as rows; an estate office with the house and the map. Read: 11 Foundation B–F, c2, c3, c3b;
  CONTRACTS §1.16. Never: the market's room. Specs: 05's walk, 16-view-buildings, 30, 25.
- **01a.** Goal: a session ends by setting something long, a night pays, the morning fits the stores. Read: 01 all;
  JOURNEY 1, 5, 7, 9; CONTRACTS §1.17, A6, A7, B6, C6, D3. Never: the waves. Specs: 42, 17, 20, 22, 25, 36; the sim.
- **03b.** Goal: neighbours who come, ask, write and tell a story through the first month. Read: 03 c4, c6–c9;
  JOURNEY 6; CONTRACTS §1.13, §3, C14. Never: order sizing. Specs: 45, 17, 25, 37, 12, 05's walk, 16-view-farm; the sim.
- **04b.** Goal: a calm first screen that grows as it matters, and a return that says what is next. Read: 04 §2 (3–5),
  c4–c6, c8, c9, c11; JOURNEY 1, 3, 7, 11; CONTRACTS §1.17, §4, B3, C5.
  Specs: 37, 20, 17, 07, 01, 04, 29, 03, 36, 14, 22.
- **05b.** Goal: each result shows where it came from, where it went and how big it was, no new draw. Read: 05 c2–c5,
  c7–c10; CONTRACTS §1.11, C1, C5, C16. Specs: 08, 16-view-farm (frozen), 05's walk, 25, 21, 22, 35, 37, 13, 33.
- **02b.** Goal: a week that waits, an album that fills, a season road that never resets. Read: 02 c1–c4, c6, c7;
  JOURNEY 4, 10; CONTRACTS §1.10, §3, A5, C9; N2. Specs: 43, 44, 35, 34, 21, 22; the sim (`PACE.road`).
- **10b.** Goal: the farm's year and weather seen, at no cost a phone feels. Read: 10 F4, c2–c4; CONTRACTS C16, D1, D2.
  Specs: 05's walk in the heaviest weather, 16 (winter, rain, snow), 26; the frame check at a 4× throttle.
- **11c.** Goal: a supermarket with more to do, a car park that grows, a dealer for paints. Read: 11 c4–c10; CONTRACTS
  §1.16, §3, C12, D2. Specs: 23, 30, 25, 27, 05's walk, 16-view-buildings; the sim (16 places).
- **09b.** Goal: a computer in the house that makes the player better at the game. Read: 09 all; CONTRACTS §1.14, B10,
  C10; N3. Never: a sale's code. Specs: 41, 25, 15, 34, 05 `-g "furniture draws"`; the sim with the mood.
- **01b.** Goal: something new every level or two to 45. Read: 01 c7, c8; JOURNEY 8; CONTRACTS §1.17, C15, D1, D2.
  Never: the rules of crops and orders. Specs: 05's walk, 16-view-farm, 25, 32, 36, 12; the sim.
- **02c.** Goal: decoration that reads as sets, can be painted, and is noticed. Read: 02 c5, F5, c8–c10; CONTRACTS §3,
  D1. Never: the road's rules. Specs: 33, 05's walk, 27, 12.
- **10c.** Goal: seasons that pay in play and looks, never as a loss. Read: 10 c5–c9; JOURNEY 2, 11, 12; CONTRACTS
  §1.15, §4.8, C8. Never: the renderer. Specs: 46, 34, 33, 25, 05's walk; the sim from each season.
- **06c.** Goal: rewards that sound their size in one key; music that follows the farm. Read: 06 c7, c10, c11;
  CONTRACTS §1.12, C4. Never: `celebrate`. Specs: 03, 35, 22.
- **08c.** Goal: the furniture drawn light, the shell at 160 KB, the sim measuring return. Read: 08 c10–c12; 11 C;
  CONTRACTS D1. Specs: 05's walk (its two debts), 27, 16-view-house, 15; `npm run build`; the health table.
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
4. `npm run check` green on the merge; its specs pass under the lock on 4185; `npm run sim` holds `PACE` if a number
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

## Scaffold proposal

None written; each waits for the orchestrator's yes.

| File | What it does |
|---|---|
| `scripts/v1-slot.sh <n>` | Readies a worktree for slot n: links `node_modules`, writes `.env.v1` (slot and ports; `.env.*` is ignored), checks the ports are free and 2 GB of disk, merges the session tip. |
| `scripts/v1-heavy.sh <command>` | The two-slot lock for Playwright, art rendering and the lab audit (`flock` on `/tmp/3d-home-v1/heavy-{1,2}.lock`, whichever frees first); prints the wait; removes `dist/` and `test-results/` after an e2e run. |
| `update-v1/owners.json` | §1 and §2 as data: each agent's owned globs, hot-file permissions (append; one line in a named function), waits, decisions, specs. |
| `scripts/v1-scope.mjs <branch>` | Checks a branch against `owners.json`: files outside its row, hot-file hunks that change or delete where only appending is allowed, never-commit files, a new package, `.only`, a changed ceiling in 05's `DEBTS`, a spec number taken (B12). |
| `scripts/v1-merge.sh <branch> [<commit>]` | In the main checkout: a clean tree, `v1-scope`, `git merge --no-ff` (up to a commit for `[early]`), the `v1/<agent>` tag, `npm run check`, the agent's specs under the lock on 4185, `npm run sim` if numbers moved; prints a summary (files, lines, hot files, results, minutes). Never pushes. |
| `scripts/v1-status.mjs` | The board: each agent's branch, commits ahead, prefix merged, which waits have landed (so the next agent starts the minute they do), slots in use, the lock's queue, the budget ledger's totals. |
| `scripts/v1-bisect.sh <spec> [-g <test>] <last-green>` | Runs a failing test at each first-parent merge since the last green commit, under the lock, and names the first red one. |
