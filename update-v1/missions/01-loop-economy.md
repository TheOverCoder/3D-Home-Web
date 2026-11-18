# Mission 01: the loop and the economy

**Goal:** every session ends by setting something long, time away pays, and something new opens every level or two
to level 45, all held by the sim.

**How a player will feel it:** before closing the game you plant cotton and queue cheese, and a short "All set" card
tells you when they will be ready. The next morning the farm has worked all night and is full of good things, with
nothing lost. Two weeks in, each level still opens a recipe, a building, more land or another animal.

## Measured today (`npm run sim`, seeds 1–3; `cameBack` timed in scratch runs outside the repo)

- **Every timer is short** (crops 45–200 s, jobs 4–40 s, producers 25–60 s), so value waiting on return stops growing
  after **5–15 min** away: 515 coins of goods at level 15 and 703 at level 27, the same after 3 h, with the line full.
  `AWAY_MOST` (3 h) changes nothing: a night away is worth what a coffee break is.
- **Income plateaus.** The good player earns 13 coins/min (levels 1–7), 49 (7–10), 77 (10–15), then 90–93 (15–32): the
  farm is full by level 15. Each level takes 30·L XP, so level 30 takes 14 min and level 60 about 30.
- **Pace.** Level 20 at 101–111 min, 25 at 151–162, 30 at 214–227. A real player (half the rate, 30 min a day, ≈ 900 XP)
  reaches level 13 on day 3, 21 on day 7, 29 on day 14 and 60 on day 59. `UNLOCKS` ends at 13: the wall is day 4.
- **Sinks.** The sim never buys decoration, fruit trees, the market (1500) or the house (4000). Catching up 24 h at
  today's 5-s steps costs 42–75 ms in Node on the fullest sim farm (3 h: 5–11 ms).

## Principles applied

- `farm-games.md` P2: a long tier (20 min – 8 h) that pays more per press and less per minute; `AWAY_MOST` 24 h; a
  `PACE` rule for the first session's timer. P3: never punish an absence; long crops need one watering only.
- `farm-games.md` P1: the chain grows (fruit into pies and jam, milk into butter and cheese), never a gate, no feed; and
  Supercell's "a few parameters" as one law per kind of timer. P5a: orders sized by level, one always quick.
- `farm-games.md` P6: something new every 1–2 levels, then every 3; `PACE` to level 30; the market and the house shown
  as goals. P7, P13, P14: storage never blocks, the daily must-do stays under 5 min, no grind wall.
- `psychology.md` §1.5 and §1.11: open loops shown as you leave, and a clean end state ("All set"). §1.12: an
  appointment is a gift, time away reads as rest. §1.2, §1.3: steady novelty, and rewards still every few minutes at
  high levels. §1.13: long timers optional, never expiring. §2 "Do NOT do": #3, #6, #7 and #11.

## Foundation first

1. **`src/farm/economy.ts` (new, pure): the laws.** Two uses now: the price of every crop and recipe, and the sim's
   measure of a return.
   - `cropWorth(s) = 2.2·s^0.4`: net coins per bed. Today's crops fit it within ±30 %: lettuce 10.0 against 10, tomato
     15.3 against 19, pumpkin 18.8 against 24. The mill's crops are judged by what they make.
   - `jobWorth(s) = 5.4·s^0.4`: the value one job adds. Cakes are +21 at 30 s, cloth +10 at 6 s; the mill is a
     converter and exempt.
   - `incomeAt(level)`: coins per minute of play at a level, fitted to the sim. 02, 03 and 05 can use it to size
     rewards in minutes of play.
2. **Crop data.** `CropDef.water`: the share of the growth one watering lasts (default `WATER_SHARE`, 0.55; a long crop
   1). A guard test: no crop, and no machine's longest recipe × `QUEUE.max`, outlasts `AWAY_MOST`.
3. **`src/farm/appointments.ts` (new, pure): what will be ready, and when** (beds, producers, machine queues, order
   waits, the tractor; soonest first), and `allSet()`: every built bed sown and every open machine with a job. Users:
   the "All set" card, and 04's welcome-back "what's next".
4. **One way to write a time: 08's `src/lib/time.ts`** (`clock`, `span`). Most of today's formatters write only m:ss,
   so an 8-h crop would read 480:00 on the prompt (`clockText`). 01 adds `readyAt(s)`: "21:40" or "tomorrow 07:10" in
   the device's own clock, never farm hours.
5. **The sim's days: 08's session runner** (`src/sim/sessions.ts`, `SESSIONS`: morning 8 min, noon 5, evening 12, a
   10-h night; between sessions the game's own `cameBack`). 01 adds:
   - a `LEAVING` list in `policy.ts`: harvest, then plant the longest open crop that ripens within the gap, then queue
     each machine with the jobs that fit the gap, dearest per press first;
   - the fruit trees, the market and the house in `forSale()`;
   - every bound, in `PACE`.
6. **`UNLOCKS`.** `RecipeKey` derived from `MACHINES`, so a recipe is a row only. One new key kind,
   `herd:<producer>:<n>`, for animals past today's herd max (cows and sheep: two uses). The cadence test replaces
   "every level opens something": every level 2–30 opens something, then no gap over 3 levels up to 45.

## Changes

| # | What the player sees | Files, functions | Rows / data | Tests | Size, risk |
|---|---|---|---|---|---|
| 1 | Nothing (the laws) | new `economy.ts` | the laws above | `economy.test.ts`: every `CROPS` row within ±30 % of `cropWorth`, every recipe of `jobWorth` | S, low |
| 2 | Nothing (the guard) | on 08's runner: `policy.ts`, `targets.ts`, `pace.test.ts` | `PACE.levels` to 30; `first`, `night`, `income`, `full` (below) | `pace.test.ts`: days 1–7 on one seed (keeps `npm run check` near 15 s); all seeds and 14 days in `npm run sim` | M, low |
| 3 | Time away counts for 24 h; long crops need one watering | `state.ts` `AWAY_MOST`, `fullWater`; `data.ts` `CropDef` | `AWAY_MOST = 24 * 3600`; `water: 1` on long crops | `away.test.ts`: cotton planted, page closed 9 h, it is ripe and counted; the guard test (Foundation 2) | S, low |
| 4 | Long times read "1 h 05", or a clock time | `readyAt` in 08's `src/lib/time.ts`; the seed packets (`FarmUI.tsx`), a bed's status (`Garden.tsx`) | — | `time.test.ts`: past midnight, and the device's 12/24 h through `Intl.DateTimeFormat` | S, low |
| 10 | Orders grow with the level, and the board always holds one quick order | `orders.ts` `makeOrder(known, random, level)`; `state.ts` (the board's refill) | `orderKinds(level) = min(9, 3 + ⌊level / 6⌋)`, few kinds still likelier; one slot asks 1–2 goods the stores hold now (`farm-games.md` P5a) | `orders.test.ts`, `state.test.ts` | S, low |
| 5 | Four long crops in the seed panel, 12 packets fitting a phone | `data.ts` `CROPS`; `models/crops.ts` (parts), `plants.ts` (growth), `goods.ts`, `gallery.ts`, `checks.ts`; `FarmUI.tsx` `SeedCard` grid; icons by `scripts/render-item-art.mjs` | crops below | `unlocks.test.ts`; `weights.test.ts`; a crop weight test (the heaviest ripe crop is the one `fillFarm` plants in `05` and `16`); e2e: the seed panel upright and sideways | M–L. Risk: the first-hour `PACE` and the budget (25 beds of the heaviest crop) |
| 6 | "All set": when every bed is sown and every machine has a job, a card for 4 s with the soonest and the longest ("Eggs 0:40 · Cotton 07:40"), then "Next ready" in the corner menu | `appointments.ts`; `TopStack.tsx` (a slot `set`, after the toast); `HudMode.tsx` (menu line) | art `check-mark-button`, `hourglass-done` (already in `art.ts`) | `appointments.test.ts`; e2e `39-appointments` (the next free number; 38 is taken), upright and sideways; `22-xp`'s top boxes include the slot | M. Risk: crowding the top; shown once per change to "all set", never repeated |
| 7 | Wave 1 (levels 14–20): new recipes on the three machines, North beds, a 4th cow, a 5th sheep | `data.ts` `RECIPES`, `MACHINES.loom`, `EXPANSIONS`, `BEDS`, `PRODUCERS.cows/sheep` names and max; `unlocks.ts`; `state.ts` `load()` (new expansion keys false); `policy.ts` patches from `EXPANSIONS` | rows below | `unlocks.test.ts` (cadence; `goodOpensAt` learns fruit from its plant's `decor:` row); `save.test.ts`: today's save loads with the new rows empty; `05-budget` and `16-view` measured again; `25-button` | M–L. Risk: the budget (beds, animals) |
| 8 | Wave 2 (levels 21–45): the dairy, the beehive, the jam kettle; Meadow and Far beds; more recipes and animals | `data.ts` `MACHINES` (dairy, kettle), `layout.ts` `PLACES`, `Workshop.tsx` (moving parts by `useMachine`), `models/buildings.ts`; the hive as a producing piece of the edit shop (`decor.ts` `FRUIT` made "producing pieces" with a `store`; `storeOf` reads it) | rows below | as in 7, plus the model checks (`checks.test.ts`, `?gallery`) and `layout.test.ts` for the new places; one commit per building | L (each building M–L). Risk: the budget, `16-view` poses, the route cells |
| 9 | A savings line on the level card: "Market 640 / 1500", then the house | `economy.ts` `nextGoal(farm)`; `levelView.ts`, `LevelCard.tsx` | — | `economy.test.ts`; `22-xp` reads the line | S. Risk: low |

**Long crops** (net coins per bed by `cropWorth`; buyers ask up to `clamp(yield, 2, 6)`):

| Crop | Grows | Seeds | Yield | Price | Net | Opens at | Used in |
|---|---|---|---|---|---|---|---|
| Sunflower | 1 h | 10 | 4 | 17 | 58 | 4 (the first appointment) | sold |
| Potato | 20 min | 5 | 6 | 7 | 37 | 7 | sold |
| Melon | 4 h | 15 | 2 | 58 | 101 | 9 | ice cream |
| Cotton | 8 h | 16 | 6 | 25 | 134 | 12 (the first night) | quilt |

**Unlock rows 14–45.** A recipe's price is its ingredients at fair price plus `jobWorth`; final numbers come from the sim.

| Lvl | Row | Time, price | Lvl | Row | Time, price |
|---|---|---|---|---|---|
| 14 | `recipe:oven:apple_pie` (4 apples, flour, sugar, egg) | 20 min, 119 | 25 | `recipe:kettle:strawberry_jam` (6, sugar): the jam kettle | 30 min, 125 |
| 15 | `upgrade:northBeds`: 4 beds on the north meadow, 400 | — | 26 | `upgrade:meadowBeds`: 4 beds, 900 | — |
| 16 | `recipe:oven:blueberry_muffins` (6, flour, sugar, egg) | 20 min, 121 | 27 | `recipe:kettle:cherry_jam` | 30 min, 131 |
| 17 | `herd:cows:4` | — | 28 | `recipe:oven:honey_cake` (2 honey, flour, 2 eggs, butter) | 40 min, 272 |
| 18 | `recipe:oven:cherry_tart` (6 cherries, flour, sugar, egg) | 30 min, 137 | 29 | `recipe:kettle:blueberry_jam` | 45 min, 151 |
| 19 | `recipe:loom:quilt` (2 cloth, 4 cotton) | 2 h, 318 | 30 | `herd:cows:5` | — |
| 20 | `herd:sheep:5` | — | 33 | `recipe:dairy:ice_cream` (2 milk, sugar, melon) | 2 h, 259 |
| 21 | `recipe:dairy:butter` (2 milk): the dairy | 10 min, 78 | 36 | `recipe:kettle:marmalade` (6 oranges, sugar) | 1 h, 178 |
| 22 | `recipe:oven:bread` (3 flour, butter, egg) | 1 h, 235 | 39 | `upgrade:farBeds`: 4 beds, 1800 | — |
| 23 | `recipe:dairy:cheese` (4 milk) | 1 h, 159 | 42 | `herd:sheep:6` | — |
| 24 | `decor:beehive`: honey (32) every 20 min, 6 a hive, up to 3 hives | 2 h to full | 45 | `recipe:kettle:raspberry_jam` | 1 h, 166 |

Levels 46–60 hold the rows from 02 (decoration sets) and 03 (the neighbours' recipes), no more than 3 levels apart; the
cadence test then extends to 60. After 60 come a garment every fifth level, the gift boxes and 02's road.

- **The night's arithmetic.** At level 25 the farm has 17 beds of cotton and queues of 3–5 places on 5 machines. A
  night adds about 4,800 coins of value (crops net of seeds, plus what the jobs add), about 37 minutes of income at
  ~130/min. Active play still earns far more per minute: lettuce 13 coins/min a bed, cotton 0.3. A machine's night is
  min(places, 8 h ÷ job) jobs, so queue places (300 – 6,500) start to pay off at night.
- **Not done, on purpose.** Producers' `max` does not grow with level: the tools' hold ladder already does it, and
  animals stay the short loop. No feed: P1 calls feed a gate. No shipments: 02 and 03. No existing timer changes, so
  the first hour stays as tuned.

**`PACE` additions (`targets.ts`):**
- **Levels 16–30:** [0.6×, 1.2×] of today's minutes, rounded. Level 20: [62, 133]; level 25: [93, 194]; level 30:
  [130, 272].
- **`first`:** the first session (15 min) ends with a timer of 1 h or more set.
- **`night`:** the night's return (08's 10 h) is worth 20–40 minutes of `incomeAt(level)` at days 2, 7 and 14, and at
  least 2× a 30-min break's return.
- **`income`:** coins/min over levels 28–30 are at least 1.4× those over levels 13–15. Today the ratio is about 1.19.
- **`full`:** a store is full at the start of no more than 1 return in 4.

## Order of commits

1. Change 1, the laws. Invisible.
2. Change 2, `PACE` on 08's runner, once 08 lands it. Invisible. The `night` and `first` rules start as `it.todo` and
   turn on in step 5.
3. Change 3, `AWAY_MOST` and `water`, after 04's festival-drain fix in `grow()`. Invisible until step 5, because no timer
   outlasts 15 min yet.
4. Change 4, `readyAt`, after 08's `time.ts`. Change 10, the orders' size, can land at any point.
5. Change 5, the long crops: one commit each (sunflower, potato, melon, cotton), each tuned with `npm run sim`. The
   `first` and `night` rules turn on with sunflower and cotton.
6. Change 6, "All set". Change 9, the savings line, can land at any point after step 2.
7. Change 7, wave 1: first the recipes, then North beds and the herd steps, each measured in `05` and `16`.
8. Change 8, wave 2: the dairy, then the beehive, then the jam kettle. Each building's commit holds its first recipe row.

## Overlaps

- **08:**
  - 08 lands `src/lib/time.ts`, the split of `state.ts` and the session runner first.
  - 01 owns `PACE` and every bound; 08 adds only `SESSIONS` and the report (as 08's file says).
  - 01's rules go into new pure modules, so its edits to `state.ts` (in 08's modules after the split) stay small.
- **04:**
  - `grow()` and the water drain: 04's festival fix lands first, and 01's `water` reads the same `fullWater`.
  - Orders: 04 adds only `ORDERS.first`, and 01 owns the size rule (change 10).
  - 04 draws `appointments()` on the welcome-back card. Proposed 04 row: a last first step, "Plant sunflowers before
    you go (ready in 1 h)".
- **03:** `ORDERS`, `makeOrder` and the board. 03 decides who asks (the neighbours); 01 decides the size and the pay.
- **02:**
  - `data.ts` and `unlocks.ts` (`ITEM_ODDS`, decoration sets): rows are only added, never reshaped, and the cadence
    test is the shared guard.
  - `gifts.ts` and `daily.ts` may be sized with `incomeAt`.
- **05:** one row each in `targets.ts`, `pace.test.ts` and `report.ts`. `rewardTier` keeps its own base
  (`levelReward`), and `celebrate` covers the "All set" card. New models follow the kit (squash through scale only).
- **06:** the sounds of the new buildings.
- **07:** `LevelCard.tsx` / `levelView.ts`, `TopStack.tsx`, `HudMode.tsx` and `FarmUI.tsx`. 01 adds one field, one
  line, one slot and one menu line, on the shared base.

## What is missing

**Decisions only the user can make** (my recommendation first):

1. **Long crops in the first hour** (sunflower 4, potato 7, melon 9, cotton 12)? **Yes**, or no (after level 13, but
   then the nights of the first two weeks are worth an hour).
2. **How long time away counts:** **24 h** (≈ 0.3 s once at load on a phone), 12 h, or no limit (a faster catch-up).
3. **How rich a morning should be:** about 20, **about 30**, or about 40 minutes of play's income.
4. **New buildings this update:** **the dairy, the beehive and the jam kettle**, or only the beehive, or none (new
   recipes on the three existing machines only).
5. **More animals** (cows 3 → 5, sheep 4 → 6) and **beds** (13 → 25)? **Yes**, if `05-budget` holds with no new debt.
6. **"All set" opens by itself** once each time the farm becomes all set? **Yes**, or only as a line in the corner menu.
7. **A savings line on the level card** (the market, then the house)? **Yes.**
8. **Notifications or an app badge?** **No** in v1: a static site cannot schedule them, and they nag (§2 #11).
9. **The names** (sunflower, potato, melon, cotton; dairy, beehive, jam kettle; quilt, muffins, tart): **accept**, or
   rename.

**Libraries:** none. `Intl.DateTimeFormat` writes clock times; the sim is the game's own code.

**Skills, knowledge and docs:** the sculpt kit and CLAUDE.md "Making models" (`crops.ts`, `plants.ts`, `goods.ts`);
`scripts/render-item-art.mjs` (dev server up); `BUDGET_MEASURE=1` for `05`; the `16-view` poses for a new place;
`plans/first-hour.md` (how `UNLOCKS` was tuned); Hay Day's timers (secondary, in `farm-games.md` P2).

**Assets:** every model is built in code (4 crops; about 15 goods, with one jar model in 5 colours and one pie and
tart model; 3 buildings). Sounds for the churn, a bubbling pot and bees: CC0 from Kenney.nl or Freesound's CC0 filter
(06's choice), or reuse `creak`, `oven` and `loom`. A bee from Fluent Emoji 3D (MIT) for the hive's card, credited in
`credits.ts`.

**Access:** nothing was blocked. This mission needs no outside host.

## Done when

- **`npm run sim` (sessions), seeds 1–3:** the first session ends with a timer of 1 h or more set; the night is worth
  20–40 min of `incomeAt` at days 2, 7 and 14, and at least 2× a 30-min break; income over levels 28–30 is at least 1.4×
  that over levels 13–15; levels 16–30 fall inside their bands and levels 2–15 still inside today's; no idle stretch
  over 5 min in the first hour; a store is full at no more than 1 return in 4.
- **Unit tests:** the cadence test (every level 2–30, then no gap over 3 levels to 45); every crop and recipe within
  ±30 % of its law; no timer outlasts `AWAY_MOST`; cotton left 9 h is ripe and counted on the card; today's saves load
  with every new row empty; `cameBack(24 h)` on the fullest test farm under 150 ms in Node.
- **e2e:** `05-budget` (25 beds of the heaviest crop, 5 cows, 6 sheep, 3 hives, 5 machines) with no new debt;
  `16-view`, `25-button`, `36-unlocks` and `39-appointments` green.
- **Screenshots at 390×844 and 844×390:** the seed panel with 12 packets, the "All set" card, a machine panel with a 2-h
  job, and the level card's savings line.
